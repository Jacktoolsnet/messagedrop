#!/usr/bin/env node

const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createHash, randomUUID } = require('node:crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
const Database = require('../db/database');
const tableOverpassPoi = require('../db/tableOverpassPoi');
const { CATEGORY_DEFINITIONS, categoryNames, subcategoryNames } = require('../categories');
const { normalizeElement } = require('../normalizer');
const { FALLBACK_DATASETS } = require('../geofabrik-catalog');
const { downloadDirectory } = require('../storage-paths');

const DATASETS = Object.freeze({
  ...FALLBACK_DATASETS
});

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const dataset = options.datasetDefinition || DATASETS[options.dataset];
  if (!dataset) throw new Error(`Unknown dataset: ${options.dataset}`);
  await requireCommand('curl');
  await requireCommand('osmium', 'Install it first with: sudo apt install osmium-tool');
  const database = new Database();
  await database.init(console);
  const jobId = options.jobId || randomUUID();
  const versionId = randomUUID();
  let staged = false;
  if (!options.jobId) {
    await callbackResult((callback) => tableOverpassPoi.createJob(database.db, {
      id: jobId,
      datasetId: dataset.id,
      requestedConfig: { categories: options.categories, subcategories: options.subcategories,
        refresh: options.refresh, force: options.force }
    }, callback));
  }
  await callbackResult((callback) => tableOverpassPoi.startJob(database.db, jobId, callback));
  process.stdout.write(`Started import job ${jobId}.\n`);
  try {
    const updateProgress = (stage, progress, details = {}) => callbackResult((callback) =>
      tableOverpassPoi.updateJobProgress(database.db, jobId, stage, progress, details, callback));
    const progress = createProgressTracker(dataset, updateProgress);
    await progress.update('checking_source', null);
    const activeSource = await callbackResult((callback) =>
      tableOverpassPoi.activeSource(database.db, dataset.id, callback));
    const sourceInfo = await inspectRemoteSource(dataset, progress);
    const importConfigHash = createImportConfigHash(options.categories, options.subcategories);
    const sourceChanged = options.force || !isImportCurrent(activeSource, sourceInfo, importConfigHash, dataset.sourceUrl);
    await callbackResult((callback) => tableOverpassPoi.updateJobSource(
      database.db, jobId, sourceInfo, sourceChanged, callback
    ));
    await progress.update('checking_source', 100);
    if (!sourceChanged) {
      await callbackResult((callback) => tableOverpassPoi.completeUnchangedJob(
        database.db, jobId, activeSource.versionId, callback
      ));
      process.stdout.write(`Dataset ${dataset.id} is already up to date; download skipped.\n`);
      return;
    }
    await tableOverpassPoi.stageVersion(database.db, {
      versionId,
      dataset: {
        ...dataset,
        sourceTimestamp: sourceInfo?.lastModified || null,
        sourceEtag: sourceInfo?.etag || null,
        sourceContentLength: sourceInfo?.contentLength || null,
        importConfigHash
      },
      categories: options.categories
    });
    staged = true;
    const poiCount = await prepareDataset(dataset, options, progress, async (batch) => {
      await tableOverpassPoi.insertPoiBatch(database.db, versionId, batch);
    });
    await progress.update('activating', null);
    await tableOverpassPoi.activateVersion(database.db, { jobId, versionId, datasetId: dataset.id, poiCount });
    if (dataset.supersedes?.length) {
      await callbackResult((callback) => tableOverpassPoi.deleteDatasets(database.db, dataset.supersedes, callback));
    }
    process.stdout.write(`Activated version ${versionId} with ${poiCount} local POIs for ${dataset.id}.\n`);
    try {
      await callbackResult((callback) => tableOverpassPoi.cleanupRetiredVersions(
        database.db,
        dataset.id,
        options.keepVersions,
        callback
      ));
    } catch (cleanupError) {
      process.stderr.write(`Version cleanup will be retried later: ${cleanupError.message}\n`);
    }
  } catch (error) {
    if (staged) {
      try { await callbackResult((callback) => tableOverpassPoi.discardVersion(database.db, versionId, callback)); } catch { /* best effort */ }
    }
    await callbackResult((callback) => tableOverpassPoi.failJob(database.db, jobId, error.message, callback));
    throw error;
  } finally {
    database.close();
  }
}

async function prepareDataset(dataset, options, progress = createProgressTracker(dataset), persistBatch = null) {
  const outputDirectory = downloadDirectory();
  await fsPromises.mkdir(outputDirectory, { recursive: true });
  const sourcePath = path.join(outputDirectory, dataset.sourceFile);
  const partialSourcePath = `${sourcePath}.part`;
  const filteredPath = path.join(outputDirectory, `${dataset.id}-poi.osm.pbf`);
  const clippedPath = path.join(outputDirectory, `${dataset.id}-poi-clipped.osm.pbf`);
  const geoJsonPath = path.join(outputDirectory, `${dataset.id}-poi.geojsonseq`);
  const expressionsPath = path.join(outputDirectory, `${dataset.id}-poi-filter-expressions.txt`);
  const downloadHeadersPath = path.join(outputDirectory, `${dataset.id}-download-headers.txt`);
  const workingFiles = [sourcePath, partialSourcePath, filteredPath, clippedPath, geoJsonPath,
    expressionsPath, downloadHeadersPath];
  await cleanupWorkingFiles(workingFiles);
  try {
  if (!await exists(sourcePath)) {
    await progress.update('downloading', 0, { processedBytes: 0 });
    await downloadWithProgress([
      '--fail', '--location', '--retry', '3', '--continue-at', '-',
      '--silent', '--show-error', '--dump-header', downloadHeadersPath,
      '--output', partialSourcePath, dataset.sourceUrl
    ], partialSourcePath, downloadHeadersPath, (stepProgress, metrics) =>
      progress.update('downloading', stepProgress, metrics));
    await fsPromises.rename(partialSourcePath, sourcePath);
  }
  await progress.update('preparing_filter', 0);
  await fsPromises.writeFile(
    expressionsPath,
    `${filterExpressions(options.categories, options.subcategories).join('\n')}\n`,
    { mode: 0o600 }
  );
  await progress.update('preparing_filter', 100);
  await progress.update('filtering', null);
  await command('osmium', [
    'tags-filter', '--overwrite', '--expressions', expressionsPath,
    '--output', filteredPath,
    sourcePath
  ]);
  await progress.update('filtering', 100);
  await fsPromises.rm(sourcePath, { force: true });
  let exportPath = filteredPath;
  if (dataset.clipToBounds) {
    const bounds = dataset.bounds;
    await progress.update('extracting', null);
    await command('osmium', ['extract', '--overwrite',
      '--bbox', `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
      '--output', clippedPath, filteredPath]);
    await progress.update('extracting', 100);
    await fsPromises.rm(filteredPath, { force: true });
    exportPath = clippedPath;
  }
  await progress.update('converting', null);
  await command('osmium', [
    'export', '--overwrite', '--output-format', 'geojsonseq',
    '--attributes', 'type,id',
    '--output', geoJsonPath,
    exportPath
  ]);
  await progress.update('converting', 100);
  await fsPromises.rm(exportPath, { force: true });

  const inputSize = (await fsPromises.stat(geoJsonPath)).size;
  await progress.update('importing', 0, { processedBytes: 0, totalBytes: inputSize, processedItems: 0 });
  const poiCount = await readPois(geoJsonPath, options.categories, options.subcategories, persistBatch,
    (stepProgress, metrics) => progress.update('importing', stepProgress, metrics));
  if (!poiCount) throw new Error('The filtered dataset contains no supported POIs');
  await progress.update('cleanup', null);
  await cleanupWorkingFiles(workingFiles);
  await progress.update('cleanup', 100);
  return poiCount;
  } finally {
    await cleanupWorkingFiles(workingFiles);
  }
}

async function inspectRemoteSource(dataset, progress = null) {
  const outputDirectory = downloadDirectory();
  await fsPromises.mkdir(outputDirectory, { recursive: true });
  const headersPath = path.join(outputDirectory, `${dataset.id}-source-check-headers.txt`);
  try {
    await command('curl', [
      '--fail', '--location', '--retry', '2', '--connect-timeout', '15', '--max-time', '60',
      '--silent', '--show-error', '--head', '--dump-header', headersPath,
      '--output', '/dev/null', dataset.sourceUrl
    ]);
    const info = await sourceInfoFromHeaders(headersPath);
    if (!info?.etag && !info?.lastModified) {
      process.stderr.write(`Source ${dataset.sourceUrl} supplied neither ETag nor Last-Modified; import will continue.\n`);
    }
    return info;
  } catch (error) {
    process.stderr.write(`Could not check source freshness (${error.message}); import will continue.\n`);
    return null;
  } finally {
    await fsPromises.rm(headersPath, { force: true });
    if (progress) await progress.update('checking_source', null);
  }
}

async function sourceInfoFromHeaders(headersPath) {
  const headers = await fsPromises.readFile(headersPath, 'utf8');
  const responses = headers.split(/\r?\n\r?\n/gu).filter(Boolean).reverse();
  const response = responses.find((value) => /^HTTP\/\S+\s+2\d\d\b/iu.test(value));
  if (!response) return null;
  const header = (name) => response.match(new RegExp(`^${name}:\\s*(.+?)\\s*$`, 'imu'))?.[1]?.trim() || null;
  const lastModifiedValue = header('last-modified');
  const lastModifiedDate = lastModifiedValue ? new Date(lastModifiedValue) : null;
  const contentLength = Number(header('content-length'));
  return {
    etag: header('etag'),
    lastModified: lastModifiedDate && Number.isFinite(lastModifiedDate.getTime()) ? lastModifiedDate.toISOString() : null,
    contentLength: Number.isFinite(contentLength) && contentLength >= 0 ? contentLength : null
  };
}

function createImportConfigHash(categories, subcategories) {
  const selectedCategories = [...new Set(categories || [])].sort();
  const normalizedSubcategories = Object.fromEntries(selectedCategories.map((category) => [
    category,
    [...new Set(subcategories?.[category] || subcategoryNames(category))].sort()
  ]));
  return createHash('sha256').update(JSON.stringify({
    formatVersion: 1,
    categories: selectedCategories,
    subcategories: normalizedSubcategories
  })).digest('hex');
}

function isImportCurrent(activeSource, remoteSource, importConfigHash, sourceUrl) {
  if (!activeSource || activeSource.sourceUrl !== sourceUrl || activeSource.importConfigHash !== importConfigHash) return false;
  if (activeSource.sourceEtag && remoteSource?.etag) return activeSource.sourceEtag === remoteSource.etag;
  if (activeSource.sourceTimestamp && remoteSource?.lastModified) {
    return new Date(activeSource.sourceTimestamp).getTime() === new Date(remoteSource.lastModified).getTime();
  }
  return false;
}

async function readPois(
  inputPath,
  categories = categoryNames(),
  selectedSubcategories = null,
  persistBatch = null,
  onProgress = null
) {
  const subcategories = Object.fromEntries(categories.map((category) => [category,
    Array.isArray(selectedSubcategories?.[category])
      ? selectedSubcategories[category]
      : subcategoryNames(category)
  ]));
  const unique = new Map();
  let poiCount = 0;
  let processedBytes = 0;
  let lastProgressAt = 0;
  const totalBytes = (await fsPromises.stat(inputPath)).size;
  let recordNumber = 0;
  for await (const rawRecord of readGeoJsonSequence(inputPath)) {
    recordNumber += 1;
    processedBytes += Buffer.byteLength(rawRecord) + 1;
    const feature = parseGeoJsonRecord(rawRecord, recordNumber);
    const element = featureToElement(feature);
    const poi = element ? normalizeElement(element, categories, subcategories) : null;
    if (poi) unique.set(poi.id, poi);
    if (persistBatch && unique.size >= 1000) {
      const batch = [...unique.values()];
      await persistBatch(batch);
      poiCount += batch.length;
      unique.clear();
      if (onProgress && Date.now() - lastProgressAt >= 1000) {
        lastProgressAt = Date.now();
        await onProgress(percent(processedBytes, totalBytes), {
          processedBytes: Math.min(processedBytes, totalBytes), totalBytes, processedItems: poiCount
        });
      }
    }
  }
  if (!persistBatch) return [...unique.values()];
  if (unique.size) {
    const batch = [...unique.values()];
    await persistBatch(batch);
    poiCount += batch.length;
  }
  if (onProgress) await onProgress(100, { processedBytes: totalBytes, totalBytes, processedItems: poiCount });
  return poiCount;
}

/**
 * Osmium writes RFC 8142 GeoJSON text sequences. Records are separated by the
 * ASCII record-separator byte (0x1e), not by line breaks. Splitting by lines is
 * unsafe because real-world OSM tag values can contain line breaks.
 *
 * The line-delimited fallback keeps tests and older, already exported files
 * readable. New exports always use the unambiguous record separator.
 */
async function* readGeoJsonSequence(inputPath) {
  let buffer = '';
  let mode = null;
  for await (const chunk of fs.createReadStream(inputPath, { encoding: 'utf8' })) {
    buffer += chunk;
    if (!mode) {
      const firstContent = buffer.search(/\S/u);
      if (firstContent < 0) continue;
      mode = buffer.charCodeAt(firstContent) === 0x1e ? 'sequence' : 'lines';
    }
    const separator = mode === 'sequence' ? '\x1e' : '\n';
    let index;
    while ((index = buffer.indexOf(separator)) >= 0) {
      const record = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (record) yield record;
    }
  }
  const record = buffer.trim();
  if (record) yield record;
}

function parseGeoJsonRecord(record, recordNumber) {
  try {
    return JSON.parse(record);
  } catch (originalError) {
    // Some historic/third-party exporters have emitted literal control
    // characters inside JSON strings. They are valid OSM tag contents but must
    // be escaped in JSON. Repair only those characters and retry once.
    try {
      return JSON.parse(escapeJsonStringControls(record));
    } catch {
      throw new Error(`Invalid GeoJSON sequence record ${recordNumber}: ${originalError.message}`);
    }
  }
}

function escapeJsonStringControls(value) {
  let result = '';
  let inString = false;
  let escaped = false;
  for (const character of value) {
    if (!inString) {
      result += character;
      if (character === '"') inString = true;
      continue;
    }
    if (escaped) {
      result += character;
      escaped = false;
      continue;
    }
    if (character === '\\') {
      result += character;
      escaped = true;
    } else if (character === '"') {
      result += character;
      inString = false;
    } else if (character === '\n') result += '\\n';
    else if (character === '\r') result += '\\r';
    else if (character === '\t') result += '\\t';
    else if (character.charCodeAt(0) < 0x20) {
      result += `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`;
    } else result += character;
  }
  return result;
}

async function cleanupWorkingFiles(paths) {
  await Promise.all(paths.map((filePath) => fsPromises.rm(filePath, { force: true })));
}

function featureToElement(feature) {
  const properties = feature?.properties;
  const type = properties?.['@type'];
  const id = Number(properties?.['@id']);
  const center = geometryCenter(feature?.geometry);
  if (!['node', 'way', 'relation'].includes(type) || !Number.isSafeInteger(id) || !center) return null;
  const tags = Object.fromEntries(Object.entries(properties)
    .filter(([key, value]) => !key.startsWith('@') && typeof value === 'string'));
  return {
    type,
    id,
    tags,
    ...(type === 'node'
      ? { lat: center.latitude, lon: center.longitude }
      : { center: { lat: center.latitude, lon: center.longitude } })
  };
}

function geometryCenter(geometry) {
  const points = [];
  collectCoordinates(geometry, points);
  if (!points.length) return null;
  const longitudes = points.map(([longitude]) => longitude);
  const latitudes = points.map(([, latitude]) => latitude);
  return {
    latitude: (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
    longitude: (Math.min(...longitudes) + Math.max(...longitudes)) / 2
  };
}

function collectCoordinates(value, points) {
  if (!value) return;
  if (Array.isArray(value) && value.length >= 2
      && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))) {
    points.push([Number(value[0]), Number(value[1])]);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectCoordinates(item, points));
    return;
  }
  if (typeof value === 'object') {
    collectCoordinates(value.coordinates, points);
    if (Array.isArray(value.geometries)) value.geometries.forEach((item) => collectCoordinates(item, points));
  }
}

function filterExpressions(categories = categoryNames(), selectedSubcategories = null) {
  const expressions = new Set();
  for (const category of categories) {
    const selected = selectedSubcategories?.[category];
    const definitions = (CATEGORY_DEFINITIONS[category] || [])
      .filter((definition) => !Array.isArray(selected) || selected.includes(definition.subcategory));
    for (const definition of definitions) {
      for (const value of definition.values) expressions.add(`nwr/${definition.key}=${value}`);
    }
  }
  return [...expressions].sort();
}

function parseArguments(args) {
  const options = {
    dataset: 'wolfenbuettel',
    refresh: false,
    force: false,
    categories: categoryNames(),
    keepVersions: Number(process.env.OVERPASS_DATASET_RETIRED_VERSIONS || 0),
    jobId: null,
    subcategories: null
  };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--refresh') options.refresh = true;
    else if (args[index] === '--force') options.force = true;
    else if (args[index] === '--dataset' && args[index + 1]) options.dataset = args[++index];
    else if (args[index] === '--categories' && args[index + 1]) {
      options.categories = [...new Set(args[++index].split(',').map((value) => value.trim()).filter(Boolean))];
    }
    else if (args[index] === '--keep-versions' && args[index + 1]) options.keepVersions = Number(args[++index]);
    else if (args[index] === '--job-id' && args[index + 1]) options.jobId = args[++index];
    else if (args[index] === '--subcategories-json' && args[index + 1]) options.subcategories = JSON.parse(args[++index]);
    else if (args[index] === '--dataset-json-base64' && args[index + 1]) {
      options.datasetDefinition = JSON.parse(Buffer.from(args[++index], 'base64url').toString('utf8'));
    }
    else throw new Error(`Unknown argument: ${args[index]}`);
  }
  if (!options.categories.length || options.categories.some((category) => !categoryNames().includes(category))) {
    throw new Error('Categories must contain supported comma-separated category names');
  }
  if (!Number.isInteger(options.keepVersions) || options.keepVersions < 0) {
    throw new Error('keep-versions must be a non-negative integer');
  }
  return options;
}

function callbackResult(register) {
  return new Promise((resolve, reject) => register((error, value) => {
    if (error) reject(error);
    else resolve(value);
  }));
}

async function requireCommand(name, hint = '') {
  try {
    await command(name, ['--version'], { quiet: true });
  } catch {
    throw new Error(`Required command '${name}' was not found. ${hint}`.trim());
  }
}

function createProgressTracker(dataset, updateProgress = async () => {}) {
  const steps = [
    { stage: 'checking_source', weight: 1 },
    { stage: 'downloading', weight: 45 },
    { stage: 'preparing_filter', weight: 1 },
    { stage: 'filtering', weight: 19 },
    ...(dataset?.clipToBounds ? [{ stage: 'extracting', weight: 5 }] : []),
    { stage: 'converting', weight: 10 },
    { stage: 'importing', weight: 15 },
    { stage: 'cleanup', weight: 2 },
    { stage: 'activating', weight: 3 }
  ];
  const totalWeight = steps.reduce((sum, step) => sum + step.weight, 0);
  let updateChain = Promise.resolve();
  return {
    steps,
    update(stage, stepProgress = null, metrics = {}) {
      const index = Math.max(0, steps.findIndex((step) => step.stage === stage));
      const completedWeight = steps.slice(0, index).reduce((sum, step) => sum + step.weight, 0);
      const currentWeight = stepProgress == null ? 0 : steps[index].weight * Math.max(0, Math.min(100, stepProgress)) / 100;
      const overallProgress = Math.min(99, Math.floor((completedWeight + currentWeight) / totalWeight * 100));
      updateChain = updateChain.then(() => updateProgress(stage, overallProgress, {
        stepNumber: index + 1,
        stepCount: steps.length,
        stepProgress,
        processedBytes: metrics.processedBytes,
        totalBytes: metrics.totalBytes,
        processedItems: metrics.processedItems
      }));
      return updateChain;
    }
  };
}

async function downloadWithProgress(args, outputPath, headersPath, onProgress) {
  let progressChain = Promise.resolve();
  const report = () => {
    progressChain = progressChain.then(async () => {
      const [processedBytes, totalBytes] = await Promise.all([
        fileSize(outputPath),
        contentLengthFromHeaders(headersPath)
      ]);
      await onProgress(totalBytes ? percent(processedBytes, totalBytes) : null, {
        processedBytes,
        totalBytes
      });
    });
  };
  const timer = setInterval(report, 1000);
  try {
    await command('curl', args, { stdio: ['ignore', 'ignore', 'inherit'] });
  } finally {
    clearInterval(timer);
  }
  report();
  await progressChain;
  const processedBytes = await fileSize(outputPath);
  await onProgress(100, { processedBytes, totalBytes: processedBytes });
}

async function fileSize(filePath) {
  try { return (await fsPromises.stat(filePath)).size; } catch { return 0; }
}

async function contentLengthFromHeaders(filePath) {
  try {
    const headers = await fsPromises.readFile(filePath, 'utf8');
    const responses = headers.split(/\r?\n\r?\n/gu).filter(Boolean).reverse();
    for (const response of responses) {
      if (!/^HTTP\/\S+\s+2\d\d\b/iu.test(response)) continue;
      const value = Number(response.match(/^content-length:\s*(\d+)\s*$/imu)?.[1]);
      return Number.isFinite(value) && value > 0 ? value : null;
    }
    return null;
  } catch {
    return null;
  }
}

function percent(value, total) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return null;
  return Math.max(0, Math.min(100, Math.round(value / total * 100)));
}

function command(program, args, { quiet = false, stdio } = {}) {
  if (!quiet) process.stdout.write(`> ${program} ${args.join(' ')}\n`);
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, { stdio: stdio || (quiet ? 'ignore' : 'inherit') });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${program} failed (${signal || `exit ${code}`})`));
    });
  });
}

async function exists(filePath) {
  try {
    await fsPromises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Could not import local Overpass dataset: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  DATASETS,
  createProgressTracker,
  featureToElement,
  filterExpressions,
  geometryCenter,
  createImportConfigHash,
  inspectRemoteSource,
  isImportCurrent,
  parseArguments,
  parseGeoJsonRecord,
  readPois,
  sourceInfoFromHeaders
};
