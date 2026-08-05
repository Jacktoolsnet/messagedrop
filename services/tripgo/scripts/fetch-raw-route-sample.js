#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
const { createTripGoClient } = require('../clients/tripgo-client');

function coordinate(name) {
  const value = process.env[name];
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a finite number`);
  return parsed;
}

async function main() {
  const outputPath = process.argv[2];
  if (!outputPath) throw new Error('Output path is required');

  const client = createTripGoClient();
  const response = await client.routes({
    from: {
      latitude: coordinate('TRIPGO_SAMPLE_FROM_LAT'),
      longitude: coordinate('TRIPGO_SAMPLE_FROM_LNG')
    },
    to: {
      latitude: coordinate('TRIPGO_SAMPLE_TO_LAT'),
      longitude: coordinate('TRIPGO_SAMPLE_TO_LNG')
    },
    locale: process.env.TRIPGO_SAMPLE_LOCALE || 'de',
    modes: (process.env.TRIPGO_SAMPLE_MODES || 'pt_pub').split(',').map((mode) => mode.trim()).filter(Boolean),
    time: null,
    avoidStops: []
  });

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(response.data, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`Raw TripGo route written to ${outputPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`Could not fetch raw TripGo route: ${error.message}\n`);
  process.exitCode = 1;
});
