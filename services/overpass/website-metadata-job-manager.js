const { randomUUID } = require('node:crypto');
const table = require('./db/tableWebsiteMetadata');
const { validateWebsiteUrl } = require('./website-metadata');

class WebsiteMetadataJobManager {
  constructor({ database, client, logger = console, refreshDays, retryHours, delayMs, maxUrls, store = table } = {}) {
    this.database = database;
    this.client = client;
    this.logger = logger;
    this.refreshDays = positiveNumber(refreshDays ?? process.env.OVERPASS_WEBSITE_METADATA_REFRESH_DAYS, 30);
    this.retryHours = positiveNumber(retryHours ?? process.env.OVERPASS_WEBSITE_METADATA_RETRY_HOURS, 24);
    this.delayMs = nonNegativeNumber(delayMs ?? process.env.OVERPASS_WEBSITE_METADATA_DELAY_MS, 1000);
    this.maxUrls = positiveNumber(maxUrls ?? process.env.OVERPASS_WEBSITE_METADATA_JOB_MAX_URLS, 100000);
    this.running = null;
    this.inFlight = new Map();
    this.store = store;
  }

  async recoverAndTrigger() {
    await callbackResult((callback) => this.store.recover(this.database.db, callback));
    return this.trigger('service-start');
  }

  async trigger(reason = 'manual') {
    if (this.running) {
      return callbackResult((callback) => this.store.runningJob(this.database.db, callback));
    }
    const active = await callbackResult((callback) => this.store.runningJob(this.database.db, callback));
    if (active) return active;
    await this.discover();
    const due = await callbackResult((callback) => this.store.listDue(
      this.database.db, this.refreshDays, this.maxUrls, callback
    ));
    if (!due.length) return null;
    const jobId = randomUUID();
    await callbackResult((callback) => this.store.createJob(this.database.db, {
      jobId, reason: String(reason).slice(0, 100), total: due.length
    }, callback));
    this.running = this.run(jobId, due).finally(() => { this.running = null; });
    void this.running;
    return callbackResult((callback) => this.store.runningJob(this.database.db, callback));
  }

  async discover() {
    const rows = await callbackResult((callback) => this.store.discoverWebsites(this.database.db, callback));
    const references = new Map();
    for (const row of rows || []) {
      try { references.set(row.websiteUrl, validateWebsiteUrl(row.websiteUrl).toString()); } catch { /* unsupported or unsafe URL */ }
    }
    for (const [websiteUrl, normalizedUrl] of references) {
      await callbackResult((callback) => this.store.ensure(this.database.db, normalizedUrl, callback));
      await callbackResult((callback) => this.store.ensureReference(this.database.db, websiteUrl, normalizedUrl, callback));
    }
    return new Set(references.values()).size;
  }

  async run(jobId, due) {
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    try {
      for (const row of due) {
        try {
          await this.fetchAndStore(row.websiteUrl);
          succeeded += 1;
        } catch (error) {
          failed += 1;
          this.logger.warn('Website metadata enrichment failed', { url: row.websiteUrl, error: error.message });
        }
        processed += 1;
        await callbackResult((callback) => this.store.updateJob(
          this.database.db, jobId, { processed, succeeded, failed }, callback
        ));
        if (processed < due.length && this.delayMs > 0) await delay(this.delayMs);
      }
      await callbackResult((callback) => this.store.completeJob(this.database.db, jobId, callback));
      this.logger.info('Website metadata enrichment completed', { jobId, processed, succeeded, failed });
    } catch (error) {
      try {
        await callbackResult((callback) => this.store.failJob(this.database.db, jobId, error.message, callback));
      } catch (databaseError) {
        this.logger.error('Could not persist website metadata job failure', { jobId, error: databaseError.message });
      }
      this.logger.error('Website metadata job failed', { jobId, error: error.message });
    }
  }

  async fetchAndStore(value) {
    const url = validateWebsiteUrl(value).toString();
    if (this.inFlight.has(url)) return this.inFlight.get(url);
    const request = (async () => {
      await callbackResult((callback) => this.store.ensure(this.database.db, url, callback));
      await callbackResult((callback) => this.store.markFetching(this.database.db, url, callback));
      try {
        const metadata = await this.client.fetch(url);
        await callbackResult((callback) => this.store.markSucceeded(
          this.database.db, url, metadata, this.refreshDays, callback
        ));
        return metadata;
      } catch (error) {
        await callbackResult((callback) => this.store.markFailed(
          this.database.db, url, error.message, this.retryHours, callback
        ));
        throw error;
      }
    })().finally(() => this.inFlight.delete(url));
    this.inFlight.set(url, request);
    return request;
  }

  async getOrFetch(value) {
    const url = validateWebsiteUrl(value).toString();
    const row = await callbackResult((callback) => this.store.get(this.database.db, url, callback));
    const fetchedAt = row?.fetchedAt ? new Date(row.fetchedAt).getTime() : 0;
    const fresh = row?.metadata && Number.isFinite(fetchedAt)
      && Date.now() - fetchedAt < this.refreshDays * 24 * 60 * 60 * 1000;
    if (fresh) return { metadata: row.metadata, cache: 'database' };
    return { metadata: await this.fetchAndStore(url), cache: 'miss' };
  }

  list(limit) {
    return callbackResult((callback) => this.store.listJobs(this.database.db, limit, callback));
  }
}

function callbackResult(register) {
  return new Promise((resolve, reject) => register((error, value) => error ? reject(error) : resolve(value)));
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

module.exports = { WebsiteMetadataJobManager };
