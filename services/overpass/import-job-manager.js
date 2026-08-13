const path = require('node:path');
const fs = require('node:fs/promises');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const table = require('./db/tableOverpassPoi');
const { GeofabrikCatalog } = require('./geofabrik-catalog');
const { categoryNames, subcategoryNames } = require('./categories');

function callbackResult(register) {
  return new Promise((resolve, reject) => register((error, value) => error ? reject(error) : resolve(value)));
}

class ImportJobManager {
  constructor({ database, logger = console, datasetCatalog } = {}) {
    this.database = database;
    this.logger = logger;
    this.children = new Map();
    this.launching = false;
    this.datasetCatalog = datasetCatalog || new GeofabrikCatalog({ logger });
    void this.recover();
  }

  async recover() {
    try {
      await callbackResult((callback) => table.failInterruptedJobs(this.database.db, callback));
      await this.cleanupInterruptedFiles();
      await this.launchNext();
    } catch (error) {
      this.logger.error('Could not recover Overpass import queue', { error: error.message });
    }
  }

  async cleanupInterruptedFiles() {
    const directory = path.resolve(__dirname, '../../docs/overpass/datasets');
    let entries;
    try { entries = await fs.readdir(directory); } catch { return; }
    const generated = entries.filter((name) => name.endsWith('.osm.pbf') || name.endsWith('.osm.pbf.part')
      || name.endsWith('.geojsonseq') || name.endsWith('-poi-filter-expressions.txt'));
    await Promise.all(generated.map((name) => fs.rm(path.join(directory, name), { force: true })));
  }

  async catalog() {
    const catalog = await this.datasetCatalog.get();
    return catalog.display.map(({ id, label, continentCode, continentLabel, countryCode, countryLabel, regionCode, level }) => ({
      id, label, continentCode, continentLabel, countryCode, countryLabel, regionCode, level
    }));
  }

  async start({ datasetId, categories = categoryNames(), subcategories = {}, refresh = true }) {
    const catalog = await this.datasetCatalog.get();
    const dataset = catalog.definitions[datasetId];
    if (!dataset) throw Object.assign(new Error('unknown_import_dataset'), { status: 400 });
    const selected = [...new Set(categories)];
    if (!selected.length || selected.some((value) => !categoryNames().includes(value))) {
      throw Object.assign(new Error('invalid_import_categories'), { status: 400 });
    }
    const selectedSubcategories = Object.fromEntries(selected.map((category) => [
      category,
      Object.hasOwn(subcategories || {}, category)
        ? [...new Set(subcategories[category])]
        : subcategoryNames(category)
    ]));
    if (Object.entries(selectedSubcategories).some(([category, values]) =>
      values.some((value) => !subcategoryNames(category).includes(value)))) {
      throw Object.assign(new Error('invalid_import_subcategories'), { status: 400 });
    }
    const importCategories = selected.filter((category) => selectedSubcategories[category].length > 0);
    if (!importCategories.length) {
      throw Object.assign(new Error('no_import_subcategories_selected'), { status: 400 });
    }
    const importSubcategories = Object.fromEntries(importCategories
      .map((category) => [category, selectedSubcategories[category]]));
    const active = await callbackResult((callback) => table.findActiveJob(this.database.db, datasetId, callback));
    if (active) return { job: active, created: false };
    const jobId = randomUUID();
    await callbackResult((callback) => table.createJob(this.database.db, {
      id: jobId, datasetId, requestedConfig: {
        categories: importCategories,
        subcategories: importSubcategories,
        refresh: Boolean(refresh)
      }
    }, callback));
    void this.launchNext();
    return { job: await this.get(jobId), created: true };
  }

  async launchNext() {
    if (this.launching || this.children.size) return;
    this.launching = true;
    let job = null;
    try {
      const running = await callbackResult((callback) => table.findRunningJob(this.database.db, callback));
      if (running) return;
      job = await callbackResult((callback) => table.findQueuedJob(this.database.db, callback));
      if (!job) return;
      const config = typeof job.requestedConfig === 'string' ? JSON.parse(job.requestedConfig) : job.requestedConfig;
      const catalog = await this.datasetCatalog.get();
      const dataset = catalog.definitions[job.datasetId];
      if (!dataset) throw new Error(`Import dataset is no longer available: ${job.datasetId}`);
      this.launch(job.jobId, dataset, config);
    } catch (error) {
      this.logger.error('Could not launch queued Overpass import', { error: error.message });
      if (job) await this.fail(job.jobId, error);
    } finally {
      this.launching = false;
    }
  }

  launch(jobId, dataset, config) {
    const args = [
      path.join(__dirname, 'scripts', 'import-local-dataset.js'),
      '--dataset', dataset.id, '--categories', config.categories.join(','), '--job-id', jobId,
      '--dataset-json-base64', Buffer.from(JSON.stringify(dataset)).toString('base64url')
    ];
    args.push('--subcategories-json', JSON.stringify(config.subcategories || {}));
    if (config.refresh) args.push('--refresh');
    const child = spawn(process.execPath, args, { cwd: __dirname, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    this.children.set(jobId, child);
    child.stdout.on('data', (data) => this.logger.info('Overpass import', { jobId, output: String(data).trim() }));
    child.stderr.on('data', (data) => this.logger.warn('Overpass import', { jobId, output: String(data).trim() }));
    child.once('error', (error) => void this.fail(jobId, error).finally(() => this.launchNext()));
    child.once('exit', (code, signal) => {
      this.children.delete(jobId);
      const completion = code !== 0
        ? this.fail(jobId, new Error(`Import process failed (${signal || `exit ${code}`})`))
        : Promise.resolve();
      void completion.finally(() => this.launchNext());
    });
  }

  get(jobId) {
    return callbackResult((callback) => table.getJob(this.database.db, jobId, callback));
  }

  list(limit) {
    return callbackResult((callback) => table.listJobs(this.database.db, limit, callback));
  }

  async fail(jobId, error) {
    try {
      await callbackResult((callback) => table.failJob(this.database.db, jobId, error.message, callback));
    } catch (dbError) {
      this.logger.error('Could not mark Overpass import as failed', { jobId, error: dbError.message });
    }
  }
}

module.exports = { ImportJobManager };
