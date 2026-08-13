const tableOverpassCache = require('./db/tableOverpassCache');

class PersistentOverpassCache {
  constructor({ database, logger = console, now = () => Date.now() } = {}) {
    this.database = database;
    this.logger = logger;
    this.now = now;
    this.metrics = { hits: 0, misses: 0, errors: 0, writes: 0 };
  }

  get enabled() {
    return !!this.database?.db;
  }

  async get(cacheKey) {
    if (!this.enabled) {
      this.metrics.misses += 1;
      return undefined;
    }
    try {
      const row = await callbackResult((callback) =>
        tableOverpassCache.get(this.database.db, cacheKey, callback));
      if (!row?.payload) {
        this.metrics.misses += 1;
        return undefined;
      }
      const fetchedAt = new Date(row.fetchedAt || row.fetchedat || 0).getTime();
      if (!Number.isFinite(fetchedAt) || fetchedAt <= 0) {
        this.metrics.misses += 1;
        return undefined;
      }
      this.metrics.hits += 1;
      return { payload: row.payload, fetchedAt, ageMs: Math.max(0, this.now() - fetchedAt) };
    } catch (error) {
      this.metrics.errors += 1;
      this.logger?.warn?.('Overpass persistent cache read failed', { error: error.message });
      return undefined;
    }
  }

  async set(cacheKey, payload) {
    if (!this.enabled) return false;
    try {
      await callbackResult((callback) => tableOverpassCache.set(this.database.db, cacheKey, payload, callback));
      this.metrics.writes += 1;
      return true;
    } catch (error) {
      this.metrics.errors += 1;
      this.logger?.warn?.('Overpass persistent cache write failed', { error: error.message });
      return false;
    }
  }

  async cleanExpired(maxAgeDays) {
    if (!this.enabled) return false;
    try {
      await callbackResult((callback) => tableOverpassCache.cleanExpired(this.database.db, maxAgeDays, callback));
      return true;
    } catch (error) {
      this.metrics.errors += 1;
      this.logger?.warn?.('Overpass persistent cache cleanup failed', { error: error.message });
      return false;
    }
  }

  snapshot() {
    return { enabled: this.enabled, ...this.metrics };
  }
}

function callbackResult(register) {
  return new Promise((resolve, reject) => register((error, value) => {
    if (error) reject(error);
    else resolve(value);
  }));
}

module.exports = { PersistentOverpassCache };
