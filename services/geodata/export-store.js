const path = require('node:path');
const { createHash } = require('node:crypto');
const table = require('./db/tableGeodataPoi');
const { exportDirectory } = require('./storage-paths');

class ExportStore {
  constructor({ database } = {}) {
    this.database = database;
  }

  async active(datasetId) {
    return callbackResult((callback) => table.getActiveExport(this.database.db, datasetId, callback));
  }

  async version(datasetId, versionId) {
    return callbackResult((callback) => table.getExport(this.database.db, datasetId, versionId, callback));
  }

  async manifest() {
    const rows = await callbackResult((callback) => table.listActiveExports(this.database.db, callback));
    const releaseId = createHash('sha256')
      .update(rows.map((row) => `${row.datasetId}:${row.versionId}`).join('\n'))
      .digest('hex');
    const generatedAt = rows.reduce((latest, row) => {
      const value = row.generatedAt ? new Date(row.generatedAt).toISOString() : null;
      return value && (!latest || value > latest) ? value : latest;
    }, null);
    return {
      dataset: 'MessageDrop OpenStreetMap POI Database',
      releaseId,
      generatedAt,
      attribution: '© OpenStreetMap contributors',
      attributionUrl: 'https://www.openstreetmap.org/copyright',
      license: 'ODbL 1.0',
      licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
      datasets: rows.map((row) => ({
        datasetId: row.datasetId,
        databaseVersion: row.versionId,
        exportVersion: row.versionId,
        generatedAt: row.generatedAt,
        recordCount: Number(row.recordCount),
        byteSize: Number(row.byteSize),
        sha256: row.sha256,
        dataUrl: `/geodata/exports/${encodeURIComponent(row.datasetId)}/${encodeURIComponent(row.versionId)}/data`,
        metadataUrl: `/geodata/exports/${encodeURIComponent(row.datasetId)}/${encodeURIComponent(row.versionId)}/metadata`,
        licenseNoticeUrl: `/geodata/exports/${encodeURIComponent(row.datasetId)}/${encodeURIComponent(row.versionId)}/license`
      }))
    };
  }

  assetPath(exportRow, asset) {
    const relativeDirectory = path.dirname(String(exportRow.relativePath || ''));
    const fileName = { data: 'pois.jsonl.gz', metadata: 'metadata.json', license: 'LICENSE.txt' }[asset];
    if (!fileName) throw new Error('unknown_export_asset');
    const root = path.resolve(exportDirectory());
    const resolved = path.resolve(root, relativeDirectory, fileName);
    if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error('invalid_export_path');
    return resolved;
  }
}

function callbackResult(register) {
  return new Promise((resolve, reject) => register((error, value) => error ? reject(error) : resolve(value)));
}

module.exports = { ExportStore };
