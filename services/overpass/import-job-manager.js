const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const table = require('./db/tableOverpassPoi');
const { DATASETS } = require('./scripts/import-local-dataset');
const { categoryNames, subcategoryNames } = require('./categories');

function callbackResult(register) {
  return new Promise((resolve, reject) => register((error, value) => error ? reject(error) : resolve(value)));
}

class ImportJobManager {
  constructor({ database, logger = console }) {
    this.database = database;
    this.logger = logger;
    this.children = new Map();
    this.launching = false;
    void this.recover();
  }

  async recover() {
    try {
      await callbackResult((callback) => table.failInterruptedJobs(this.database.db, callback));
      await this.launchNext();
    } catch (error) {
      this.logger.error('Could not recover Overpass import queue', { error: error.message });
    }
  }

  catalog() {
    return Object.values(DATASETS).map(({ id, label, continentCode, continentLabel, countryCode, countryLabel, regionCode, level, bounds, sourceUrl }) => ({
      id, label, continentCode, continentLabel, countryCode, countryLabel, regionCode, level, bounds, sourceUrl
    }));
  }

  async start({ datasetId, categories = categoryNames(), subcategories = {}, refresh = true }) {
    const dataset = DATASETS[datasetId];
    if (!dataset) throw Object.assign(new Error('unknown_import_dataset'), { status: 400 });
    const selected = [...new Set(categories)];
    if (!selected.length || selected.some((value) => !categoryNames().includes(value))) {
      throw Object.assign(new Error('invalid_import_categories'), { status: 400 });
    }
    const selectedSubcategories = Object.fromEntries(selected
      .filter((category) => Object.hasOwn(subcategories || {}, category))
      .map((category) => [category, [...new Set(subcategories[category])]]));
    if (Object.entries(selectedSubcategories).some(([category, values]) =>
      values.some((value) => !subcategoryNames(category).includes(value)))) {
      throw Object.assign(new Error('invalid_import_subcategories'), { status: 400 });
    }
    const active = await callbackResult((callback) => table.findActiveJob(this.database.db, datasetId, callback));
    if (active) return { job: active, created: false };
    const jobId = randomUUID();
    await callbackResult((callback) => table.createJob(this.database.db, {
      id: jobId, datasetId, requestedConfig: { categories: selected, subcategories: selectedSubcategories, refresh: Boolean(refresh) }
    }, callback));
    void this.launchNext();
    return { job: await this.get(jobId), created: true };
  }

  async launchNext() {
    if (this.launching || this.children.size) return;
    this.launching = true;
    try {
      const running = await callbackResult((callback) => table.findRunningJob(this.database.db, callback));
      if (running) return;
      const job = await callbackResult((callback) => table.findQueuedJob(this.database.db, callback));
      if (!job) return;
      const config = typeof job.requestedConfig === 'string' ? JSON.parse(job.requestedConfig) : job.requestedConfig;
      this.launch(job.jobId, job.datasetId, config);
    } catch (error) {
      this.logger.error('Could not launch queued Overpass import', { error: error.message });
    } finally {
      this.launching = false;
    }
  }

  launch(jobId, datasetId, config) {
    const args = [
      path.join(__dirname, 'scripts', 'import-local-dataset.js'),
      '--dataset', datasetId, '--categories', config.categories.join(','), '--job-id', jobId
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
