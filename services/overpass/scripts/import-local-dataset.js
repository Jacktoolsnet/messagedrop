#!/usr/bin/env node

const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');
const readline = require('node:readline');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
const Database = require('../db/database');
const tableOverpassPoi = require('../db/tableOverpassPoi');
const { CATEGORY_DEFINITIONS, categoryNames, subcategoryNames } = require('../categories');
const { normalizeElement } = require('../normalizer');

const DATASETS = Object.freeze({
  germany: Object.freeze({
    id: 'germany',
    label: 'Germany',
    continentCode: 'EU',
    continentLabel: 'Europe',
    countryCode: 'DE',
    countryLabel: 'Germany',
    regionCode: null,
    level: 'country',
    supersedes: Object.freeze(['wolfenbuettel']),
    sourceUrl: 'https://download.geofabrik.de/europe/germany-latest.osm.pbf',
    sourceFile: 'germany-latest.osm.pbf',
    bounds: Object.freeze({ south: 47.2701, west: 5.8663, north: 55.0992, east: 15.0419 })
  }),
  wolfenbuettel: Object.freeze({
    id: 'wolfenbuettel',
    label: 'Wolfenbüttel',
    continentCode: 'EU',
    continentLabel: 'Europe',
    countryCode: 'DE',
    countryLabel: 'Germany',
    regionCode: 'DE-NI',
    level: 'test',
    clipToBounds: true,
    sourceUrl: 'https://download.geofabrik.de/europe/germany/niedersachsen-latest.osm.pbf',
    sourceFile: 'niedersachsen-latest.osm.pbf',
    bounds: Object.freeze({ south: 52.05, west: 10.40, north: 52.30, east: 10.75 })
  })
});

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const dataset = DATASETS[options.dataset];
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
      requestedConfig: { categories: options.categories, subcategories: options.subcategories, refresh: options.refresh }
    }, callback));
  }
  await callbackResult((callback) => tableOverpassPoi.startJob(database.db, jobId, callback));
  process.stdout.write(`Started import job ${jobId}.\n`);
  try {
    const updateProgress = (stage, progress) => callbackResult((callback) =>
      tableOverpassPoi.updateJobProgress(database.db, jobId, stage, progress, callback));
    await tableOverpassPoi.stageVersion(database.db, {
      versionId, dataset: { ...dataset, sourceTimestamp: null }, categories: options.categories
    });
    staged = true;
    const poiCount = await prepareDataset(dataset, options, updateProgress, async (batch) => {
      await tableOverpassPoi.insertPoiBatch(database.db, versionId, batch);
    });
    await updateProgress('activating', 95);
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

async function prepareDataset(dataset, options, updateProgress = async () => {}, persistBatch = null) {
  const outputDirectory = path.resolve(__dirname, '../../../docs/overpass/datasets');
  await fsPromises.mkdir(outputDirectory, { recursive: true });
  const sourcePath = path.join(outputDirectory, dataset.sourceFile);
  const partialSourcePath = `${sourcePath}.part`;
  const filteredPath = path.join(outputDirectory, `${dataset.id}-poi.osm.pbf`);
  const clippedPath = path.join(outputDirectory, `${dataset.id}-poi-clipped.osm.pbf`);
  const geoJsonPath = path.join(outputDirectory, `${dataset.id}-poi.geojsonseq`);
  const expressionsPath = path.join(outputDirectory, `${dataset.id}-poi-filter-expressions.txt`);
  await cleanupWorkingFiles([sourcePath, partialSourcePath, filteredPath, clippedPath, geoJsonPath, expressionsPath]);
  try {
  if (!await exists(sourcePath)) {
    await updateProgress('downloading', 5);
    await command('curl', [
      '--fail', '--location', '--retry', '3', '--continue-at', '-',
      '--output', partialSourcePath, dataset.sourceUrl
    ]);
    await fsPromises.rename(partialSourcePath, sourcePath);
  }
  await fsPromises.writeFile(
    expressionsPath,
    `${filterExpressions(options.categories, options.subcategories).join('\n')}\n`,
    { mode: 0o600 }
  );
  await updateProgress('filtering', 55);
  await command('osmium', [
    'tags-filter', '--overwrite', '--expressions', expressionsPath,
    '--output', filteredPath,
    sourcePath
  ]);
  await fsPromises.rm(sourcePath, { force: true });
  let exportPath = filteredPath;
  if (dataset.clipToBounds) {
    const bounds = dataset.bounds;
    await updateProgress('extracting', 65);
    await command('osmium', ['extract', '--overwrite',
      '--bbox', `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
      '--output', clippedPath, filteredPath]);
    await fsPromises.rm(filteredPath, { force: true });
    exportPath = clippedPath;
  }
  await updateProgress('converting', 70);
  await command('osmium', [
    'export', '--overwrite', '--output-format', 'geojsonseq',
    '--attributes', 'type,id', '--format-option', 'print_record_separator=false',
    '--output', geoJsonPath,
    exportPath
  ]);
  await fsPromises.rm(exportPath, { force: true });

  await updateProgress('normalizing', 80);
  const poiCount = await readPois(geoJsonPath, options.categories, options.subcategories, persistBatch);
  if (!poiCount) throw new Error('The filtered dataset contains no supported POIs');
  return poiCount;
  } finally {
    await cleanupWorkingFiles([sourcePath, partialSourcePath, filteredPath, clippedPath, geoJsonPath, expressionsPath]);
  }
}

async function readPois(inputPath, categories = categoryNames(), selectedSubcategories = null, persistBatch = null) {
  const subcategories = Object.fromEntries(categories.map((category) => [category,
    Array.isArray(selectedSubcategories?.[category])
      ? selectedSubcategories[category]
      : subcategoryNames(category)
  ]));
  const unique = new Map();
  let poiCount = 0;
  const lines = readline.createInterface({
    input: fs.createReadStream(inputPath, { encoding: 'utf8' }),
    crlfDelay: Infinity
  });
  for await (const rawLine of lines) {
    const line = (rawLine.charCodeAt(0) === 0x1e ? rawLine.slice(1) : rawLine).trim();
    if (!line) continue;
    const feature = JSON.parse(line);
    const element = featureToElement(feature);
    const poi = element ? normalizeElement(element, categories, subcategories) : null;
    if (poi) unique.set(poi.id, poi);
    if (persistBatch && unique.size >= 1000) {
      const batch = [...unique.values()];
      await persistBatch(batch);
      poiCount += batch.length;
      unique.clear();
    }
  }
  if (!persistBatch) return [...unique.values()];
  if (unique.size) {
    const batch = [...unique.values()];
    await persistBatch(batch);
    poiCount += batch.length;
  }
  return poiCount;
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
    categories: categoryNames(),
    keepVersions: Number(process.env.OVERPASS_DATASET_RETIRED_VERSIONS || 0),
    jobId: null,
    subcategories: null
  };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--refresh') options.refresh = true;
    else if (args[index] === '--dataset' && args[index + 1]) options.dataset = args[++index];
    else if (args[index] === '--categories' && args[index + 1]) {
      options.categories = [...new Set(args[++index].split(',').map((value) => value.trim()).filter(Boolean))];
    }
    else if (args[index] === '--keep-versions' && args[index + 1]) options.keepVersions = Number(args[++index]);
    else if (args[index] === '--job-id' && args[index + 1]) options.jobId = args[++index];
    else if (args[index] === '--subcategories-json' && args[index + 1]) options.subcategories = JSON.parse(args[++index]);
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

function command(program, args, { quiet = false } = {}) {
  if (!quiet) process.stdout.write(`> ${program} ${args.join(' ')}\n`);
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, { stdio: quiet ? 'ignore' : 'inherit' });
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
  featureToElement,
  filterExpressions,
  geometryCenter,
  parseArguments,
  readPois
};
