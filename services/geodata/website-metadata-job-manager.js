const { randomUUID } = require('node:crypto');
const table = require('./db/tableWebsiteMetadata');
const { validateWebsiteUrl } = require('./website-metadata');

class WebsiteMetadataJobManager {
  constructor({
    database, client, logger = console, refreshDays, retryHours,
    concurrency, domainDelayMs, delayMs, maxUrls, store = table
  } = {}) {
    this.database = database;
    this.client = client;
    this.logger = logger;
    this.refreshDays = positiveNumber(refreshDays ?? process.env.GEODATA_WEBSITE_METADATA_REFRESH_DAYS, 30);
    this.retryHours = positiveNumber(retryHours ?? process.env.GEODATA_WEBSITE_METADATA_RETRY_HOURS, 1);
    this.concurrency = positiveInteger(
      concurrency ?? process.env.GEODATA_WEBSITE_METADATA_CONCURRENCY,
      4
    );
    this.domainDelayMs = nonNegativeNumber(
      domainDelayMs ?? delayMs ?? process.env.GEODATA_WEBSITE_METADATA_DOMAIN_DELAY_MS,
      1000
    );
    this.maxUrls = positiveNumber(maxUrls ?? process.env.GEODATA_WEBSITE_METADATA_JOB_MAX_URLS, 100000);
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
    const hasReferences = await callbackResult((callback) => this.store.hasReferences(this.database.db, callback));
    const shouldDiscover = reason === 'import-completed' || !hasReferences;
    const jobId = randomUUID();
    await callbackResult((callback) => this.store.createJob(this.database.db, {
      jobId, reason: String(reason).slice(0, 100), total: 0
    }, callback));
    const job = await callbackResult((callback) => this.store.runningJob(this.database.db, callback));
    this.running = this.prepareAndRun(jobId, shouldDiscover).finally(() => { this.running = null; });
    void this.running;
    return job;
  }

  async prepareAndRun(jobId, shouldDiscover) {
    try {
      if (shouldDiscover) await this.discover();
      const due = await callbackResult((callback) => this.store.listDue(
        this.database.db, this.refreshDays, this.maxUrls, callback
      ));
      await callbackResult((callback) => this.store.setJobTotal(this.database.db, jobId, due.length, callback));
      if (!due.length) {
        await callbackResult((callback) => this.store.completeJob(this.database.db, jobId, callback));
        return;
      }
      await this.run(jobId, due);
    } catch (error) {
      try {
        await callbackResult((callback) => this.store.failJob(this.database.db, jobId, error.message, callback));
      } catch (databaseError) {
        this.logger.error('Could not persist website metadata preparation failure', {
          jobId, error: databaseError.message
        });
      }
      this.logger.error('Website metadata preparation failed', { jobId, error: error.message });
    }
  }

  async discover() {
    const rows = await callbackResult((callback) => this.store.discoverWebsites(this.database.db, callback));
    const references = new Map();
    for (const row of rows || []) {
      try { references.set(row.websiteUrl, validateWebsiteUrl(row.websiteUrl).toString()); } catch { /* unsupported or unsafe URL */ }
    }
    const entries = [...references].map(([websiteUrl, normalizedUrl]) => ({ websiteUrl, normalizedUrl }));
    for (let index = 0; index < entries.length; index += 500) {
      await callbackResult((callback) => this.store.ensureReferencesBatch(
        this.database.db, entries.slice(index, index + 500), callback
      ));
    }
    return new Set(references.values()).size;
  }

  async run(jobId, due) {
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    let progressWrite = Promise.resolve();
    try {
      await runDomainAwareQueue(due, {
        concurrency: this.concurrency,
        domainDelayMs: this.domainDelayMs,
        handler: async (row) => {
          let retryAfterMs = 0;
          try {
            await this.fetchAndStore(row.websiteUrl);
            succeeded += 1;
          } catch (error) {
            failed += 1;
            retryAfterMs = nonNegativeNumber(error?.retryAfterMs, 0);
            this.logger.warn('Website metadata enrichment failed', { url: row.websiteUrl, error: error.message });
          }
          processed += 1;
          const progress = { processed, succeeded, failed };
          progressWrite = progressWrite.then(() => callbackResult((callback) => this.store.updateJob(
            this.database.db, jobId, progress, callback
          )));
          await progressWrite;
          return { domainDelayMs: retryAfterMs };
        }
      });
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
      const previous = await callbackResult((callback) => this.store.get(this.database.db, url, callback));
      const attemptCount = Math.max(1, Number(previous?.attemptCount || 0) + 1);
      await callbackResult((callback) => this.store.markFetching(this.database.db, url, callback));
      try {
        const metadata = await this.client.fetch(url);
        if (!hasUsefulMetadata(metadata)) {
          await callbackResult((callback) => this.store.markNoMetadata(this.database.db, url, callback));
          return metadata;
        }
        await callbackResult((callback) => this.store.markSucceeded(
          this.database.db, url, metadata, this.refreshDays, callback
        ));
        return metadata;
      } catch (error) {
        const classification = classifyMetadataError(error, attemptCount, this.retryHours);
        if (classification.kind === 'permanent') {
          await callbackResult((callback) => this.store.markPermanentFailed(
            this.database.db, url, classification, callback
          ));
        } else {
          await callbackResult((callback) => this.store.markRetryableFailed(
            this.database.db, url, classification, callback
          ));
        }
        throw error;
      }
    })().finally(() => this.inFlight.delete(url));
    this.inFlight.set(url, request);
    return request;
  }

  async getOrFetch(value) {
    const url = validateWebsiteUrl(value).toString();
    const row = await callbackResult((callback) => this.store.get(this.database.db, url, callback));
    if (row?.outcome === 'no_metadata' || row?.outcome === 'permanent_error') {
      return {
        metadata: row.metadata || null, cache: 'database', outcome: row.outcome,
        errorCode: row.errorCode || null, httpStatus: row.httpStatus || null
      };
    }
    const nextAttemptAt = row?.nextAttemptAt ? new Date(row.nextAttemptAt).getTime() : 0;
    if (row?.outcome === 'retryable_error' && Number.isFinite(nextAttemptAt) && nextAttemptAt > Date.now()) {
      return {
        metadata: row.metadata || null, cache: row.metadata ? 'stale' : 'database', outcome: row.outcome,
        retryAt: row.nextAttemptAt, errorCode: row.errorCode || null, httpStatus: row.httpStatus || null
      };
    }
    const fetchedAt = row?.fetchedAt ? new Date(row.fetchedAt).getTime() : 0;
    const fresh = row?.metadata && Number.isFinite(fetchedAt)
      && Date.now() - fetchedAt < this.refreshDays * 24 * 60 * 60 * 1000;
    if (fresh) return { metadata: row.metadata, cache: 'database', outcome: row.outcome || 'metadata' };
    const metadata = await this.fetchAndStore(url);
    const outcome = hasUsefulMetadata(metadata) ? 'metadata' : 'no_metadata';
    return { metadata: outcome === 'metadata' ? metadata : null, cache: 'miss', outcome };
  }

  list(limit) {
    return callbackResult((callback) => this.store.listJobs(this.database.db, limit, callback));
  }
}

function callbackResult(register) {
  return new Promise((resolve, reject) => register((error, value) => error ? reject(error) : resolve(value)));
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function hasUsefulMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false;
  return Object.entries(metadata).some(([key, value]) =>
    key !== 'url' && key !== 'fetchedAt' && value !== null && value !== undefined
      && (!(typeof value === 'string') || value.trim().length > 0));
}

function classifyMetadataError(error, attemptCount = 1, initialRetryHours = 1) {
  const httpStatus = positiveIntegerOrNull(error?.httpStatus);
  const errorCode = String(error?.errorCode || error?.message || 'website_metadata_upstream_error').slice(0, 200);
  const networkCode = String(error?.networkCode || error?.cause?.code || '').toUpperCase();
  const permanentCodes = new Set([
    'invalid_website_url',
    'website_metadata_private_address',
    'website_metadata_not_html',
    'website_metadata_head_too_large',
    'website_metadata_too_many_redirects'
  ]);
  const transientHttp = new Set([408, 425, 429]);
  const permanent = permanentCodes.has(errorCode)
    || networkCode === 'ENOTFOUND' || networkCode === 'ENODATA' || networkCode === 'EAI_NONAME'
    || (httpStatus >= 300 && httpStatus < 400)
    || (httpStatus >= 400 && httpStatus < 500 && !transientHttp.has(httpStatus));
  const base = {
    kind: permanent ? 'permanent' : 'retryable',
    error: String(error?.message || errorCode),
    errorCode: networkCode || errorCode,
    httpStatus
  };
  if (permanent) return base;
  const retryAfterMs = Number(error?.retryAfterMs);
  const delayMs = Number.isFinite(retryAfterMs) && retryAfterMs > 0
    ? retryAfterMs
    : retryDelayMs(attemptCount, initialRetryHours);
  return { ...base, retryAt: new Date(Date.now() + delayMs).toISOString() };
}

function retryDelayMs(attemptCount, initialRetryHours = 1) {
  const attempt = Math.max(1, Number(attemptCount) || 1);
  const configuredFirstRetry = Math.max(1, Number(initialRetryHours) || 1);
  const hours = attempt === 1 ? configuredFirstRetry
    : attempt === 2 ? Math.max(6, configuredFirstRetry)
      : attempt === 3 ? Math.max(24, configuredFirstRetry)
        : attempt === 4 ? Math.max(72, configuredFirstRetry)
          : Math.max(168, configuredFirstRetry);
  return hours * 60 * 60 * 1000;
}

function positiveIntegerOrNull(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function domainKey(value) {
  const hostname = new URL(value).hostname.toLowerCase();
  return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
}

function runDomainAwareQueue(rows, { concurrency = 4, domainDelayMs = 1000, handler } = {}) {
  const items = Array.isArray(rows) ? rows : [];
  if (!items.length) return Promise.resolve();
  if (typeof handler !== 'function') return Promise.reject(new TypeError('Metadata queue handler is required'));

  const queues = new Map();
  for (const row of items) {
    const key = domainKey(row.websiteUrl);
    const queue = queues.get(key) || { items: [], index: 0 };
    queue.items.push(row);
    queues.set(key, queue);
  }

  const workerLimit = positiveInteger(concurrency, 4);
  const cooldown = nonNegativeNumber(domainDelayMs, 1000);
  const ready = [...queues.keys()];
  let readyIndex = 0;
  let active = 0;
  let completed = 0;
  let settled = false;

  return new Promise((resolve, reject) => {
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const pump = () => {
      if (settled) return;
      while (active < workerLimit && readyIndex < ready.length) {
        const key = ready[readyIndex++];
        const queue = queues.get(key);
        if (!queue || queue.index >= queue.items.length) continue;
        const row = queue.items[queue.index++];
        active += 1;
        Promise.resolve(handler(row)).then((result) => {
          active -= 1;
          completed += 1;
          if (queue.index < queue.items.length) {
            const nextDelay = Math.max(cooldown, nonNegativeNumber(result?.domainDelayMs, 0));
            if (nextDelay > 0) {
              setTimeout(() => {
                if (settled) return;
                ready.push(key);
                pump();
              }, nextDelay);
            } else {
              ready.push(key);
            }
          }
          if (completed >= items.length) {
            settled = true;
            resolve();
            return;
          }
          pump();
        }, fail);
      }
    };
    pump();
  });
}

module.exports = {
  WebsiteMetadataJobManager, classifyMetadataError, domainKey, hasUsefulMetadata,
  retryDelayMs, runDomainAwareQueue
};
