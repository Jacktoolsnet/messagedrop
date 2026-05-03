#!/usr/bin/env node

const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    let value = rawValue.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const repoRoot = path.resolve(__dirname, '..', '..');
loadDotEnv(path.join(repoRoot, '.env'));

function baseUrl(envName, fallbackPort) {
  const configured = process.env[envName];
  if (configured) return configured.replace(/\/+$/, '');
  return `http://127.0.0.1:${fallbackPort}`;
}

const bases = {
  backend: baseUrl('SECURITY_BACKEND_URL', process.env.PORT || 3000),
  admin: baseUrl('SECURITY_ADMIN_URL', process.env.ADMIN_PORT || 3100),
  openMeteo: baseUrl('SECURITY_OPENMETEO_URL', process.env.OPENMETEO_PORT || 3200),
  nominatim: baseUrl('SECURITY_NOMINATIM_URL', process.env.NOMINATIM_PORT || 3300),
  socketio: baseUrl('SECURITY_SOCKETIO_URL', process.env.SOCKETIO_PORT || 3400),
  viator: baseUrl('SECURITY_VIATOR_URL', process.env.VIATOR_PORT || 3500),
  sticker: baseUrl('SECURITY_STICKER_URL', process.env.STICKER_PORT || 3600)
};

const EXPECT_AUTH_BLOCKED = new Set([401, 403]);

const tests = [
  { name: 'backend /user/renewjwt blocks missing token', method: 'GET', url: `${bases.backend}/user/renewjwt`, expect: EXPECT_AUTH_BLOCKED },
  { name: 'backend /user/renewjwt blocks invalid token', method: 'GET', url: `${bases.backend}/user/renewjwt`, token: 'invalid-token', expect: EXPECT_AUTH_BLOCKED },
  { name: 'backend /user/get/:id blocks missing token', method: 'GET', url: `${bases.backend}/user/get/security-smoke-user`, expect: EXPECT_AUTH_BLOCKED },
  { name: 'backend /message/me/userId/:id blocks missing token', method: 'GET', url: `${bases.backend}/message/me/userId/security-smoke-user`, expect: EXPECT_AUTH_BLOCKED },
  { name: 'backend /openai/moderate blocks missing token', method: 'POST', url: `${bases.backend}/openai/moderate`, body: { message: 'security smoke test' }, expect: EXPECT_AUTH_BLOCKED },
  { name: 'backend /utils/resolve blocks missing token', method: 'GET', url: `${bases.backend}/utils/resolve/${encodeURIComponent('https://example.com')}`, expect: EXPECT_AUTH_BLOCKED },

  { name: 'admin /user/me blocks missing token', method: 'GET', url: `${bases.admin}/user/me`, expect: EXPECT_AUTH_BLOCKED },
  { name: 'admin /ai/settings blocks missing token', method: 'GET', url: `${bases.admin}/ai/settings`, expect: EXPECT_AUTH_BLOCKED },
  { name: 'admin /maintenance blocks missing token', method: 'GET', url: `${bases.admin}/maintenance`, expect: EXPECT_AUTH_BLOCKED },

  { name: 'openMeteo /check blocks missing service token', method: 'POST', url: `${bases.openMeteo}/check`, expect: EXPECT_AUTH_BLOCKED },
  { name: 'nominatim /check blocks missing service token', method: 'POST', url: `${bases.nominatim}/check`, expect: EXPECT_AUTH_BLOCKED },
  { name: 'socketio /emit/user blocks missing service token', method: 'POST', url: `${bases.socketio}/emit/user`, body: { userId: 'security-smoke-user', event: 'security-smoke', payload: {} }, expect: EXPECT_AUTH_BLOCKED },
  { name: 'viator non-public route blocks missing service token', method: 'GET', url: `${bases.viator}/viator/internal/security-smoke`, expect: EXPECT_AUTH_BLOCKED },
  { name: 'sticker /check blocks missing service token', method: 'POST', url: `${bases.sticker}/check`, expect: EXPECT_AUTH_BLOCKED },
  { name: 'sticker /sticker/bootstrap blocks missing service token', method: 'GET', url: `${bases.sticker}/sticker/bootstrap`, expect: EXPECT_AUTH_BLOCKED }
];

function request({ method, url, token, body, timeoutMs = 5000 }) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const headers = {};
    if (payload) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = String(payload.length);
    }
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }

    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.request({
      method,
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port,
      path: `${parsed.pathname}${parsed.search}`,
      headers,
      timeout: timeoutMs
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: Buffer.concat(chunks).toString('utf8').slice(0, 500)
        });
      });
    });

    req.on('timeout', () => req.destroy(new Error(`timeout after ${timeoutMs}ms`)));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

(async () => {
  console.log('Security smoke tests for protected routes');
  console.log('Base URLs:', bases);
  console.log('');

  const failures = [];
  for (const test of tests) {
    try {
      const response = await request(test);
      const ok = test.expect.has(response.statusCode);
      const marker = ok ? 'PASS' : 'FAIL';
      console.log(`${marker} ${test.name} -> ${response.statusCode}`);
      if (!ok) {
        failures.push({ test, response });
      }
    } catch (error) {
      console.log(`FAIL ${test.name} -> ${error.message}`);
      failures.push({ test, error });
    }
  }

  if (failures.length) {
    console.error('');
    console.error(`${failures.length} protected-route smoke test(s) failed.`);
    process.exit(1);
  }

  console.log('');
  console.log('All protected-route smoke tests passed.');
})();
