#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const SERVICE_LABELS = {
  BACKEND: 'Messagedrop Backend',
  ADMIN: 'Admin Backend',
  STICKER: 'Sticker Service',
  VIATOR: 'Viator Service',
  OPENMETEO: 'OpenMeteo Service',
  NOMINATIM: 'Nominatim Service'
};

function parseEnvFile(filePath) {
  const values = {};
  if (!fs.existsSync(filePath)) return values;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2] ?? '';
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function resolveFromDatabaseUrl(connectionString) {
  if (!connectionString) return {};
  const url = new URL(connectionString);
  return {
    host: url.hostname || 'localhost',
    port: url.port || '5432',
    database: url.pathname ? decodeURIComponent(url.pathname.replace(/^\//, '')) : '',
    user: decodeURIComponent(url.username || ''),
    password: decodeURIComponent(url.password || '')
  };
}

function buildConfig(prefix, env) {
  const fromUrl = resolveFromDatabaseUrl(env[`${prefix}_DATABASE_URL`] || '');
  return {
    name: SERVICE_LABELS[prefix] || prefix,
    host: fromUrl.host || env[`${prefix}_DB_HOST`] || 'localhost',
    port: fromUrl.port || env[`${prefix}_DB_PORT`] || '5432',
    database: fromUrl.database || env[`${prefix}_DB_NAME`],
    user: fromUrl.user || env[`${prefix}_DB_USER`],
    password: fromUrl.password || env[`${prefix}_DB_PASSWORD`] || ''
  };
}

function connectionArg(config) {
  const parts = [
    'driver=postgresql',
    `name=${config.name}`,
    `host=${config.host}`,
    `port=${config.port}`,
    `database=${config.database}`,
    `user=${config.user || ''}`
  ];
  if (config.password) parts.push(`password=${config.password}`);
  return parts.join('|');
}

const prefix = String(process.argv[2] || '').trim().toUpperCase();
if (!SERVICE_LABELS[prefix]) {
  console.error(`Usage: node tools/db/open-dbeaver.js <${Object.keys(SERVICE_LABELS).join('|')}>`);
  process.exit(2);
}

const workspace = path.resolve(__dirname, '..', '..');
const env = { ...parseEnvFile(path.join(workspace, '.env.example')), ...parseEnvFile(path.join(workspace, '.env')) };
const config = buildConfig(prefix, env);

if (!config.database) {
  console.error(`No database configured for ${prefix}. Expected ${prefix}_DB_NAME or ${prefix}_DATABASE_URL.`);
  process.exit(1);
}

const executable = process.env.DBEAVER_BIN || 'dbeaver';
const args = ['-con', connectionArg(config)];
console.log(`Starting DBeaver for ${config.name} (${config.host}:${config.port}/${config.database}) ...`);

const child = spawn(executable, args, {
  cwd: workspace,
  detached: true,
  stdio: 'ignore'
});
child.unref();
