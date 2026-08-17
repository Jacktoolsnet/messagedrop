const tableGeodataPoi = require('./db/tableGeodataPoi');

class LocalPoiStore {
  constructor({ database, logger = console, statusCacheMs = process.env.GEODATA_STATUS_CACHE_MS || 60000 } = {}) {
    this.database = database;
    this.logger = logger;
    this.metrics = { hits: 0, misses: 0, errors: 0 };
    this.statusCacheMs = Math.max(0, Number(statusCacheMs) || 0);
    this.statusCache = null;
    this.statusInFlight = null;
  }

  get enabled() {
    return !!this.database?.db;
  }

  async getNearby(request) {
    if (!this.enabled) return undefined;
    try {
      const dataset = await callbackResult((callback) =>
        tableGeodataPoi.coveringDataset(this.database.db, request.bounds, request.categories, callback));
      if (!dataset) {
        this.metrics.misses += 1;
        return undefined;
      }
      const rows = await callbackResult((callback) => tableGeodataPoi.nearby(
        this.database.db,
        dataset.versionId,
        request.bounds,
        request.subcategories,
        request.limit,
        callback
      ));
      this.metrics.hits += 1;
      return {
        status: 200,
        pois: rows.map(({ payload }) => payload),
        count: rows.length,
        attribution: {
          provider: 'OpenStreetMap',
          text: '© OpenStreetMap contributors',
          url: 'https://www.openstreetmap.org/copyright',
          license: 'ODbL 1.0',
          licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/'
        },
        source: {
          type: 'local-dataset',
          datasetId: dataset.datasetId,
          versionId: dataset.versionId,
          timestamp: dataset.sourceTimestamp || null,
          importedAt: dataset.importedAt,
          url: dataset.sourceUrl
        }
      };
    } catch (error) {
      this.metrics.errors += 1;
      this.logger?.warn?.('Local Geodata POI query failed', { error: error.message });
      return undefined;
    }
  }

  async status() {
    if (!this.enabled) return emptyStatus();
    if (this.statusCache && this.statusCache.expiresAt > Date.now()) return this.statusCache.value;
    if (this.statusInFlight) return this.statusInFlight;

    this.statusInFlight = this.loadStatus();
    try { return await this.statusInFlight; }
    finally { this.statusInFlight = null; }
  }

  async loadStatus() {
    try {
      const status = await callbackResult((callback) => tableGeodataPoi.status(this.database.db, callback));
      const value = {
        ...status,
        databaseBytes: status?.databaseBytes == null ? null : Number(status.databaseBytes)
      };
      if (this.statusCacheMs > 0) {
        this.statusCache = { value, expiresAt: Date.now() + this.statusCacheMs };
      }
      return value;
    } catch (error) {
      this.metrics.errors += 1;
      this.logger?.warn?.('Local Geodata POI status failed', { error: error.message });
      return emptyStatus();
    }
  }

  snapshot() {
    return { enabled: this.enabled, ...this.metrics };
  }
}

function emptyStatus() {
  return {
    datasetCount: 0,
    poiCount: 0,
    websitePoiCount: 0,
    importedAt: null,
    databaseBytes: null
  };
}

function callbackResult(register) {
  return new Promise((resolve, reject) => register((error, value) => {
    if (error) reject(error);
    else resolve(value);
  }));
}

module.exports = { LocalPoiStore };
