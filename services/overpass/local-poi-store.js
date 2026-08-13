const tableOverpassPoi = require('./db/tableOverpassPoi');

class LocalPoiStore {
  constructor({ database, logger = console } = {}) {
    this.database = database;
    this.logger = logger;
    this.metrics = { hits: 0, misses: 0, errors: 0 };
  }

  get enabled() {
    return !!this.database?.db;
  }

  async getNearby(request) {
    if (!this.enabled) return undefined;
    try {
      const dataset = await callbackResult((callback) =>
        tableOverpassPoi.coveringDataset(this.database.db, request.bounds, request.categories, callback));
      if (!dataset) {
        this.metrics.misses += 1;
        return undefined;
      }
      const rows = await callbackResult((callback) => tableOverpassPoi.nearby(
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
        pois: rows.map(({ payload, websiteMetadata }) => websiteMetadata
          ? { ...payload, websiteMetadata }
          : payload),
        count: rows.length,
        attribution: {
          provider: 'OpenStreetMap',
          text: '© OpenStreetMap contributors',
          url: 'https://www.openstreetmap.org/copyright',
          license: 'ODbL 1.0'
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
      this.logger?.warn?.('Local Overpass POI query failed', { error: error.message });
      return undefined;
    }
  }

  async status() {
    if (!this.enabled) return emptyStatus();
    try {
      const status = await callbackResult((callback) => tableOverpassPoi.status(this.database.db, callback));
      return {
        ...status,
        databaseBytes: status?.databaseBytes == null ? null : Number(status.databaseBytes)
      };
    } catch (error) {
      this.metrics.errors += 1;
      this.logger?.warn?.('Local Overpass POI status failed', { error: error.message });
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
    websiteMetadataPoiCount: 0,
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
