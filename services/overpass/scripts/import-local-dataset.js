#!/usr/bin/env node

const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');
const readline = require('node:readline');
const { spawn } = require('node:child_process');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
const Database = require('../db/database');
const tableOverpassPoi = require('../db/tableOverpassPoi');
const { CATEGORY_DEFINITIONS, categoryNames, subcategoryNames } = require('../categories');
const { normalizeElement } = require('../normalizer');

const DATASETS = Object.freeze({
  wolfenbuettel: Object.freeze({
    id: 'wolfenbuettel',
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

  const outputDirectory = path.resolve(__dirname, '../../../docs/overpass/datasets');
  await fsPromises.mkdir(outputDirectory, { recursive: true });
  const sourcePath = path.join(outputDirectory, dataset.sourceFile);
  const partialSourcePath = `${sourcePath}.part`;
  const extractPath = path.join(outputDirectory, `${dataset.id}.osm.pbf`);
  const filteredPath = path.join(outputDirectory, `${dataset.id}-poi.osm.pbf`);
  const geoJsonPath = path.join(outputDirectory, `${dataset.id}-poi.geojsonseq`);
  const expressionsPath = path.join(outputDirectory, 'poi-filter-expressions.txt');

  if (options.refresh) {
    await Promise.all([
      fsPromises.rm(sourcePath, { force: true }),
      fsPromises.rm(partialSourcePath, { force: true })
    ]);
  }
  if (!await exists(sourcePath)) {
    await command('curl', [
      '--fail', '--location', '--retry', '3', '--continue-at', '-',
      '--output', partialSourcePath, dataset.sourceUrl
    ]);
    await fsPromises.rename(partialSourcePath, sourcePath);
  } else {
    process.stdout.write(`Using existing source file ${sourcePath}\n`);
  }

  const bounds = dataset.bounds;
  await command('osmium', [
    'extract', '--overwrite',
    '--bbox', `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
    '--output', extractPath,
    sourcePath
  ]);
  await fsPromises.writeFile(expressionsPath, `${filterExpressions().join('\n')}\n`, { mode: 0o600 });
  await command('osmium', [
    'tags-filter', '--overwrite', '--expressions', expressionsPath,
    '--output', filteredPath,
    extractPath
  ]);
  await command('osmium', [
    'export', '--overwrite', '--output-format', 'geojsonseq',
    '--attributes', 'type,id', '--format-option', 'print_record_separator=false',
    '--output', geoJsonPath,
    filteredPath
  ]);

  const pois = await readPois(geoJsonPath);
  if (!pois.length) throw new Error('The filtered dataset contains no supported POIs');
  const database = new Database();
  await database.init(console);
  try {
    await tableOverpassPoi.replaceDataset(database.db, {
      ...dataset,
      sourceTimestamp: null
    }, pois);
  } finally {
    database.close();
  }
  process.stdout.write(`Imported ${pois.length} local POIs for ${dataset.id}.\n`);
}

async function readPois(inputPath) {
  const categories = categoryNames();
  const subcategories = Object.fromEntries(categories.map((category) => [category, subcategoryNames(category)]));
  const unique = new Map();
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
  }
  return [...unique.values()];
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

function filterExpressions() {
  const expressions = new Set();
  for (const definitions of Object.values(CATEGORY_DEFINITIONS)) {
    for (const definition of definitions) {
      for (const value of definition.values) expressions.add(`nwr/${definition.key}=${value}`);
    }
  }
  return [...expressions].sort();
}

function parseArguments(args) {
  const options = { dataset: 'wolfenbuettel', refresh: false };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--refresh') options.refresh = true;
    else if (args[index] === '--dataset' && args[index + 1]) options.dataset = args[++index];
    else throw new Error(`Unknown argument: ${args[index]}`);
  }
  return options;
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
