const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');
const readline = require('node:readline');
const { createHash } = require('node:crypto');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { createGzip, createGunzip } = require('node:zlib');
const table = require('./db/tableGeodataPoi');
const { exportDirectory } = require('./storage-paths');

const FORMAT_VERSION = 1;
const LICENSE_URL = 'https://opendatacommons.org/licenses/odbl/1-0/';
const ATTRIBUTION_URL = 'https://www.openstreetmap.org/copyright';

async function generateDatasetExport({
  database, dataset, versionId, expectedCount, logger = console,
  onGenerateProgress, onValidateProgress
}) {
  const db = database.db || database;
  const root = exportDirectory();
  const relativeDirectory = path.join('datasets', safeSegment(dataset.id), safeSegment(versionId));
  const finalDirectory = path.join(root, relativeDirectory);
  const temporaryDirectory = `${finalDirectory}.part`;
  const dataPath = path.join(temporaryDirectory, 'pois.jsonl.gz');
  await callbackResult((callback) => table.beginExport(db, { versionId, datasetId: dataset.id }, callback));
  await callbackResult((callback) => table.updateVersionImportConfig(db, versionId, {
    dataset: {
      id: dataset.id, label: dataset.label || dataset.id,
      continentCode: dataset.continentCode || null, continentLabel: dataset.continentLabel || null,
      countryCode: dataset.countryCode || null,
      countryCodes: dataset.countryCodes || (dataset.countryCode ? [dataset.countryCode] : []),
      countryLabel: dataset.countryLabel || null, regionCode: dataset.regionCode || null,
      level: dataset.level || null, bounds: dataset.bounds
    },
    categories: dataset.importConfig?.categories || [],
    subcategories: dataset.importConfig?.subcategories || {}
  }, callback));
  await fsPromises.rm(temporaryDirectory, { recursive: true, force: true });
  await fsPromises.mkdir(temporaryDirectory, { recursive: true, mode: 0o700 });
  try {
    const generatedAt = new Date().toISOString();
    const generation = await writeJsonlGzip(db, versionId, dataPath, expectedCount, onGenerateProgress);
    const validation = await validateJsonlGzip(dataPath, expectedCount, onValidateProgress);
    if (generation.recordCount !== validation.recordCount) {
      throw new Error(`Export count changed during validation (${generation.recordCount} != ${validation.recordCount})`);
    }
    const stat = await fsPromises.stat(dataPath);
    const sha256 = await sha256File(dataPath);
    const metadata = exportMetadata({
      dataset, versionId, generatedAt, recordCount: validation.recordCount,
      byteSize: stat.size, sha256
    });
    await fsPromises.writeFile(path.join(temporaryDirectory, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`, { mode: 0o600 });
    await fsPromises.writeFile(path.join(temporaryDirectory, 'LICENSE.txt'), licenseNotice(), { mode: 0o600 });
    await fsPromises.mkdir(path.dirname(finalDirectory), { recursive: true, mode: 0o700 });
    await fsPromises.rm(finalDirectory, { recursive: true, force: true });
    await fsPromises.rename(temporaryDirectory, finalDirectory);
    const relativePath = path.join(relativeDirectory, 'pois.jsonl.gz');
    await callbackResult((callback) => table.completeExport(db, {
      versionId, relativePath, recordCount: validation.recordCount,
      byteSize: stat.size, sha256, metadata
    }, callback));
    return { ...metadata, relativePath };
  } catch (error) {
    await fsPromises.rm(temporaryDirectory, { recursive: true, force: true });
    try { await callbackResult((callback) => table.failExport(db, versionId, error.message, callback)); }
    catch (dbError) { logger.warn?.('Could not mark Geodata export as failed', { versionId, error: dbError.message }); }
    throw error;
  }
}

async function writeJsonlGzip(db, versionId, outputPath, expectedCount, onProgress) {
  let recordCount = 0;
  let afterType = null;
  let afterId = null;
  async function* records() {
    while (true) {
      const rows = await callbackResult((callback) => table.exportPoiBatch(
        db, versionId, afterType, afterId, 5000, callback
      ));
      if (!rows.length) break;
      for (const row of rows) {
        const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
        if (row.osmType !== payload?.osmType || Number(row.osmId) !== Number(payload?.osmId)) {
          throw new Error(`POI index and payload disagree for ${row.osmType}:${row.osmId}`);
        }
        yield `${JSON.stringify(payload)}\n`;
        recordCount += 1;
      }
      const last = rows.at(-1);
      afterType = last.osmType;
      afterId = Number(last.osmId);
      await onProgress?.(percentage(recordCount, expectedCount), { processedItems: recordCount });
    }
  }
  await pipeline(Readable.from(records()), createGzip({ level: gzipLevel() }), fs.createWriteStream(outputPath, { mode: 0o600 }));
  if (recordCount !== Number(expectedCount)) {
    throw new Error(`Exported ${recordCount} POIs but database contains ${expectedCount}`);
  }
  return { recordCount };
}

async function validateJsonlGzip(inputPath, expectedCount, onProgress) {
  const input = fs.createReadStream(inputPath).pipe(createGunzip());
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  let recordCount = 0;
  for await (const line of lines) {
    if (!line) continue;
    const value = JSON.parse(line);
    validatePoi(value, recordCount + 1);
    recordCount += 1;
    if (recordCount % 5000 === 0) {
      await onProgress?.(percentage(recordCount, expectedCount), { processedItems: recordCount });
    }
  }
  if (recordCount !== Number(expectedCount)) {
    throw new Error(`Validated ${recordCount} POIs but database contains ${expectedCount}`);
  }
  await onProgress?.(100, { processedItems: recordCount });
  return { recordCount };
}

function validatePoi(value, lineNumber) {
  const valid = value && typeof value === 'object'
    && /^osm:(node|way|relation):\d+$/u.test(String(value.id || ''))
    && ['node', 'way', 'relation'].includes(value.osmType)
    && Number.isSafeInteger(Number(value.osmId))
    && typeof value.category === 'string' && value.category.length > 0
    && typeof value.subtype === 'string' && value.subtype.length > 0
    && Number.isFinite(Number(value.latitude)) && Number(value.latitude) >= -90 && Number(value.latitude) <= 90
    && Number.isFinite(Number(value.longitude)) && Number(value.longitude) >= -180 && Number(value.longitude) <= 180
    && value.source?.provider === 'OpenStreetMap'
    && /^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/\d+$/u.test(String(value.source?.url || ''));
  if (!valid) throw new Error(`Invalid POI in export at line ${lineNumber}`);
}

function exportMetadata({ dataset, versionId, generatedAt, recordCount, byteSize, sha256 }) {
  return {
    dataset: 'MessageDrop OpenStreetMap POI Database',
    datasetId: dataset.id,
    databaseVersion: versionId,
    exportVersion: versionId,
    generatedAt,
    source: 'OpenStreetMap',
    sourceUrl: dataset.sourceUrl,
    sourceTimestamp: dataset.sourceTimestamp || null,
    sourceEtag: dataset.sourceEtag || null,
    sourceContentLength: dataset.sourceContentLength == null ? null : Number(dataset.sourceContentLength),
    sourceExtractProvider: 'Geofabrik GmbH',
    sourceExtractProviderUrl: 'https://download.geofabrik.de/',
    countryCodes: dataset.countryCodes || (dataset.countryCode ? [dataset.countryCode] : []),
    bounds: dataset.bounds,
    categories: dataset.importConfig?.categories || [],
    subcategories: dataset.importConfig?.subcategories || {},
    importConfigHash: dataset.importConfigHash || null,
    recordCount,
    format: 'jsonl',
    formatVersion: FORMAT_VERSION,
    compression: 'gzip',
    mediaType: 'application/x-ndjson',
    byteSize,
    sha256,
    license: 'ODbL 1.0',
    licenseUrl: LICENSE_URL,
    attribution: '© OpenStreetMap contributors',
    attributionUrl: ATTRIBUTION_URL,
    processing: 'Filtered, categorized, normalized and geometrically processed by the MessageDrop Geodata Service.'
  };
}

function licenseNotice() {
  return `MessageDrop OpenStreetMap POI Database

Contains data derived from OpenStreetMap.

© OpenStreetMap contributors
${ATTRIBUTION_URL}

Licensed under the Open Database License 1.0:
${LICENSE_URL}

Source extracts obtained from:
Geofabrik GmbH
https://download.geofabrik.de/

The OpenStreetMap source data has been filtered, categorized, normalized and
geometrically processed by the MessageDrop Geodata Service.
`;
}

async function sha256File(filePath) {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

async function cleanupExportStorage(db, logger = console) {
  const root = exportDirectory();
  await fsPromises.mkdir(path.join(root, 'datasets'), { recursive: true, mode: 0o700 });
  const rows = await callbackResult((callback) => table.listVersionIds(db, callback));
  const retained = new Set(rows.map(({ versionId }) => String(versionId)));
  const datasetRoot = path.join(root, 'datasets');
  for (const datasetEntry of await directoryEntries(datasetRoot)) {
    if (!datasetEntry.isDirectory()) continue;
    const directory = path.join(datasetRoot, datasetEntry.name);
    for (const versionEntry of await directoryEntries(directory)) {
      if (!versionEntry.isDirectory()) continue;
      const isTemporary = versionEntry.name.endsWith('.part');
      if (isTemporary || !retained.has(versionEntry.name)) {
        try { await fsPromises.rm(path.join(directory, versionEntry.name), { recursive: true, force: true }); }
        catch (error) { logger.warn?.('Could not clean Geodata export directory', { error: error.message }); }
      }
    }
  }
}

async function directoryEntries(directory) {
  try { return await fsPromises.readdir(directory, { withFileTypes: true }); }
  catch (error) { return error.code === 'ENOENT' ? [] : Promise.reject(error); }
}

function safeSegment(value) {
  const segment = String(value || '');
  if (!/^[a-zA-Z0-9_-]+$/u.test(segment)) throw new Error(`Unsafe export path segment: ${segment}`);
  return segment;
}

function percentage(value, total) {
  return Number(total) > 0 ? Math.max(0, Math.min(100, Math.floor(Number(value) / Number(total) * 100))) : null;
}

function gzipLevel() {
  const configured = Number(process.env.GEODATA_EXPORT_GZIP_LEVEL);
  return Number.isInteger(configured) && configured >= 1 && configured <= 9 ? configured : 6;
}

function callbackResult(register) {
  return new Promise((resolve, reject) => register((error, value) => error ? reject(error) : resolve(value)));
}

module.exports = {
  ATTRIBUTION_URL,
  FORMAT_VERSION,
  LICENSE_URL,
  cleanupExportStorage,
  exportMetadata,
  generateDatasetExport,
  gzipLevel,
  licenseNotice,
  safeSegment,
  sha256File,
  validateJsonlGzip,
  validatePoi,
  writeJsonlGzip
};
