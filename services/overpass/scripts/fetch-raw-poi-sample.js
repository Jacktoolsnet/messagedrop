#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
const { createOverpassClient } = require('../clients/overpass-client');
const { validateNearbyRequest } = require('../validation');
const { buildNearbyQuery } = require('../query-builder');

async function main() {
  const outputPath = process.argv[2];
  const diagnosticsPath = process.argv[3];
  if (!outputPath) throw new Error('Output path is required');

  const request = {
    bounds: {
      south: finiteNumber('OVERPASS_SAMPLE_SOUTH', '52.34'),
      west: finiteNumber('OVERPASS_SAMPLE_WEST', '9.65'),
      north: finiteNumber('OVERPASS_SAMPLE_NORTH', '52.43'),
      east: finiteNumber('OVERPASS_SAMPLE_EAST', '9.85')
    },
    categories: (process.env.OVERPASS_SAMPLE_CATEGORIES || 'accommodation,tourism')
      .split(',').map((value) => value.trim()).filter(Boolean),
    limit: positiveInteger('OVERPASS_SAMPLE_LIMIT', '500')
  };
  const validated = validateNearbyRequest(request);
  if (!validated.ok) throw new Error(validated.message);
  const query = buildNearbyQuery(validated.value);
  const client = createOverpassClient();
  const startedAt = new Date();
  const startNs = process.hrtime.bigint();
  const response = await client.query(query);
  const durationMs = Number(process.hrtime.bigint() - startNs) / 1e6;
  const rawJson = `${JSON.stringify(response.data, null, 2)}\n`;

  await writePrivateJson(outputPath, rawJson);
  process.stdout.write(`Raw Overpass POIs written to ${outputPath}\n`);

  if (diagnosticsPath) {
    const elements = Array.isArray(response.data?.elements) ? response.data.elements : [];
    const diagnostics = {
      fetchedAt: startedAt.toISOString(),
      endpoint: process.env.OVERPASS_API_BASE_URL || 'https://overpass-api.de/api/interpreter',
      request: validated.value,
      query,
      responseStatus: response.status,
      durationMs: Math.round(durationMs),
      responseBytes: Buffer.byteLength(rawJson, 'utf8'),
      elementCount: elements.length,
      elementTypes: countBy(elements, (element) => element?.type || 'unknown'),
      osmBaseTimestamp: response.data?.osm3s?.timestamp_osm_base || null
    };
    await writePrivateJson(diagnosticsPath, `${JSON.stringify(diagnostics, null, 2)}\n`);
    process.stdout.write(`Overpass request diagnostics written to ${diagnosticsPath}\n`);
  }
}

function finiteNumber(name, fallback) {
  const parsed = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a finite number`);
  return parsed;
}

function positiveInteger(name, fallback) {
  const parsed = finiteNumber(name, fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function countBy(values, keySelector) {
  return Object.fromEntries([...values.reduce((counts, value) => {
    const key = keySelector(value);
    counts.set(key, (counts.get(key) || 0) + 1);
    return counts;
  }, new Map())].sort(([left], [right]) => left.localeCompare(right)));
}

async function writePrivateJson(outputPath, contents) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, contents, { mode: 0o600 });
}

main().catch((error) => {
  process.stderr.write(`Could not fetch raw Overpass POIs: ${error.message}\n`);
  if (error.response?.data) {
    const detail = typeof error.response.data === 'string'
      ? error.response.data.slice(0, 4000)
      : JSON.stringify(error.response.data, null, 2);
    process.stderr.write(`${detail}\n`);
  }
  process.exitCode = 1;
});
