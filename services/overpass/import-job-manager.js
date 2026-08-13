const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const table = require('./db/tableOverpassPoi');
const { DATASETS } = require('./scripts/import-local-dataset');
const { categoryNames } = require('./categories');

function callbackResult(register) {
  return new Promise((resolve, reject) => register((error, value) => error ? reject(error) : resolve(value)));
}

class ImportJobManager {
  constructor({ database, logger = console }) {
    this.database = database;
    this.logger = logger;
    this.children = new Map();
  }

  catalog() {
    return Object.values(DATASETS).map(({ id, label, countryCode, regionCode, bounds, sourceUrl }) => ({
      id, label, countryCode, regionCode, bounds, sourceUrl
    }));
  }

  async start({ datasetId, categories = categoryNames(), refresh = true }) {
    const dataset = DATASETS[datasetId];
    if (!dataset) throw Object.assign(new Error('unknown_import_dataset'), { status: 400 });
    const selected = [...new Set(categories)];
    if (!selected.length || selected.some((value) => !categoryNames().includes(value))) {
      throw Object.assign(new Error('invalid_import_categories'), { status: 400 });
    }
    const active = await callbackResult((callback) => table.findActiveJob(this.database.db, datasetId, callback));
    if (active) return { job: active, created: false };

    const jobId = randomUUID();
    await callbackResult((callback) => table.createJob(this.database.db, {
      id: jobId, datasetId, requestedConfig: { categories: selected, refresh: Boolean(refresh) }
    }, callback));
    const args = [
      path.join(__dirname, 'scripts', 'import-local-dataset.js'),
      '--dataset', datasetId, '--categories', selected.join(','), '--job-id', jobId
    ];
    if (refresh) args.push('--refresh');
    const child = spawn(process.execPath, args, { cwd: __dirname, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    this.children.set(jobId, child);
    child.stdout.on('data', (data) => this.logger.info('Overpass import', { jobId, output: String(data).trim() }));
    child.stderr.on('data', (data) => this.logger.warn('Overpass import', { jobId, output: String(data).trim() }));
    child.once('error', (error) => void this.fail(jobId, error));
    child.once('exit', (code, signal) => {
      this.children.delete(jobId);
      if (code !== 0) void this.fail(jobId, new Error(`Import process failed (${signal || `exit ${code}`})`));
    });
    return { job: await this.get(jobId), created: true };
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
