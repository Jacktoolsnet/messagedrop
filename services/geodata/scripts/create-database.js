#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
const { Client } = require('pg');

async function main() {
  const settings = databaseSettings();
  const reset = process.argv.includes('--reset');
  if (reset && !process.argv.includes('--yes')) {
    throw new Error('Database reset requires the explicit --yes argument');
  }
  const client = new Client(settings.connection);
  await client.connect();
  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [settings.database]);
    if (existing.rowCount > 0) {
      if (reset) {
        await client.query(`
          SELECT pg_terminate_backend(pid)
          FROM pg_stat_activity
          WHERE datname = $1 AND pid <> pg_backend_pid()
        `, [settings.database]);
        await client.query(`DROP DATABASE ${quoteIdentifier(settings.database)}`);
        await client.query(`CREATE DATABASE ${quoteIdentifier(settings.database)} OWNER ${quoteIdentifier(settings.owner)}`);
        process.stdout.write(`Database ${settings.database} recreated for ${settings.owner}.\n`);
        return;
      }
      process.stdout.write(`Database ${settings.database} already exists.\n`);
      return;
    }
    await client.query(`CREATE DATABASE ${quoteIdentifier(settings.database)} OWNER ${quoteIdentifier(settings.owner)}`);
    process.stdout.write(`Database ${settings.database} created for ${settings.owner}.\n`);
  } finally {
    await client.end();
  }
}

function databaseSettings() {
  const connectionString = process.env.GEODATA_DATABASE_URL;
  if (connectionString) {
    const url = new URL(connectionString);
    const database = decodeURIComponent(url.pathname.replace(/^\//u, ''));
    if (!database) throw new Error('GEODATA_DATABASE_URL must include a database name');
    const owner = decodeURIComponent(url.username || process.env.GEODATA_DB_USER || 'messagedrop');
    url.pathname = '/postgres';
    return {
      database,
      owner,
      connection: {
        connectionString: url.toString(),
        ssl: sslConfig()
      }
    };
  }
  const database = process.env.GEODATA_DB_NAME || 'messagedrop_geodata';
  const owner = process.env.GEODATA_DB_USER || 'messagedrop';
  return {
    database,
    owner,
    connection: {
      host: process.env.GEODATA_DB_HOST || 'localhost',
      port: Number(process.env.GEODATA_DB_PORT || 5432),
      database: process.env.GEODATA_DB_MAINTENANCE_NAME || 'postgres',
      user: owner,
      password: process.env.GEODATA_DB_PASSWORD || undefined,
      ssl: sslConfig()
    }
  };
}

function sslConfig() {
  return String(process.env.GEODATA_DB_SSL || '').toLowerCase() === 'true'
    ? { rejectUnauthorized: false }
    : undefined;
}

function quoteIdentifier(value) {
  const normalized = String(value || '');
  if (!/^[A-Za-z_][A-Za-z0-9_$-]{0,62}$/u.test(normalized)) {
    throw new Error(`Unsafe PostgreSQL identifier: ${normalized}`);
  }
  return `"${normalized.replaceAll('"', '""')}"`;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Could not create Geodata database: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { databaseSettings, quoteIdentifier };
