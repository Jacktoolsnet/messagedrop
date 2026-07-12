#!/usr/bin/env node

const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');
const crypto = require('node:crypto');

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
  wikipedia: baseUrl('SECURITY_WIKIPEDIA_URL', process.env.WIKIPEDIA_PORT || 3700),
  socketio: baseUrl('SECURITY_SOCKETIO_URL', process.env.SOCKETIO_PORT || 3400),
  viator: baseUrl('SECURITY_VIATOR_URL', process.env.VIATOR_PORT || 3500),
  sticker: baseUrl('SECURITY_STICKER_URL', process.env.STICKER_PORT || 3600)
};

const EXPECT_AUTH_BLOCKED = new Set([401, 403]);
const EXPECT_OK = new Set([200]);
const EXPECT_NOT_FOUND_OR_METHOD_BLOCKED = new Set([404, 405]);
const EXPECT_CORS_REJECTED = new Set([200, 204, 401, 403, 404, 405]);
const EXPECT_BAD_REQUEST = new Set([400]);
const EXPECT_METHOD_NOT_SUCCESS = new Set([400, 401, 403, 404, 405]);
const EVIL_ORIGIN = process.env.SECURITY_EVIL_ORIGIN || 'https://evil.example.com';
const backendAllowedOrigin = firstCsvValue(process.env.ORIGIN);
const adminAllowedOrigin = firstCsvValue(process.env.ADMIN_ORIGIN);

function firstCsvValue(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)[0] || null;
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signHs256(payload, secret, header = {}) {
  const encodedHeader = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT', ...header }));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signingInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${signingInput}.${signature}`;
}

function makeUserJwt(overrides = {}, secret = process.env.JWT_SECRET || 'security-smoke-wrong-secret') {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return signHs256({
    userId: 'security-smoke-user',
    iat: nowSeconds,
    exp: nowSeconds + 3600,
    aud: process.env.JWT_AUD || 'messagedrop-frontend',
    iss: process.env.JWT_ISS || 'https://auth.messagedrop.app/',
    ...overrides
  }, secret);
}

function makeAdminJwt(overrides = {}, secret = process.env.ADMIN_JWT_SECRET || 'security-smoke-wrong-admin-secret') {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return signHs256({
    sub: 'security-smoke-admin',
    roles: ['admin'],
    iat: nowSeconds,
    exp: nowSeconds + 3600,
    aud: process.env.ADMIN_AUD || 'messagedrop-admin',
    iss: process.env.ADMIN_ISS || 'https://admin-auth.messagedrop.app/',
    ...overrides
  }, secret);
}

const userTokenWithoutAudIss = signHs256({
  userId: 'security-smoke-user',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600
}, process.env.JWT_SECRET || 'security-smoke-secret');

const userTokenWrongAudience = makeUserJwt({ aud: 'wrong-audience' });
const userTokenWrongIssuer = makeUserJwt({ iss: 'https://wrong-issuer.example/' });
const expiredUserToken = makeUserJwt({ exp: Math.floor(Date.now() / 1000) - 60 });
const userTokenWrongSecret = makeUserJwt({}, 'security-smoke-wrong-secret');
const adminTokenWrongAudience = makeAdminJwt({ aud: 'wrong-admin-audience' });
const adminTokenWrongIssuer = makeAdminJwt({ iss: 'https://wrong-admin-issuer.example/' });
const expiredAdminToken = makeAdminJwt({ exp: Math.floor(Date.now() / 1000) - 60 });
const validUserToken = makeUserJwt();

const tests = [
  {
    name: 'backend /user/renewjwt accepts valid user JWT and returns a token',
    method: 'GET',
    url: `${bases.backend}/user/renewjwt`,
    rawToken: validUserToken,
    expect: EXPECT_OK,
    assert: (res) => {
      if (!isJsonResponse(res) || !hasNoStoreHeaders(res) || !responseDoesNotLeakDetails(res)) {
        return false;
      }
      try {
        const parsed = JSON.parse(res.body);
        return typeof (parsed.token || parsed.jwt) === 'string'
          && (parsed.token || parsed.jwt).split('.').length === 3;
      } catch {
        return false;
      }
    }
  },
  { group: 'auth', name: 'backend /user/renewjwt blocks token without aud/iss', method: 'GET', url: `${bases.backend}/user/renewjwt`, rawToken: userTokenWithoutAudIss, expect: EXPECT_AUTH_BLOCKED },
  { group: 'auth', name: 'backend /user/renewjwt blocks token with wrong audience', method: 'GET', url: `${bases.backend}/user/renewjwt`, rawToken: userTokenWrongAudience, expect: EXPECT_AUTH_BLOCKED },
  { group: 'auth', name: 'backend /user/renewjwt blocks token with wrong issuer', method: 'GET', url: `${bases.backend}/user/renewjwt`, rawToken: userTokenWrongIssuer, expect: EXPECT_AUTH_BLOCKED },
  { group: 'auth', name: 'backend /user/renewjwt blocks expired token', method: 'GET', url: `${bases.backend}/user/renewjwt`, rawToken: expiredUserToken, expect: EXPECT_AUTH_BLOCKED },
  { group: 'auth', name: 'backend /user/renewjwt blocks token with wrong secret', method: 'GET', url: `${bases.backend}/user/renewjwt`, rawToken: userTokenWrongSecret, expect: EXPECT_AUTH_BLOCKED },
  { name: 'backend /user/renewjwt blocks missing token', method: 'GET', url: `${bases.backend}/user/renewjwt`, expect: EXPECT_AUTH_BLOCKED },
  { name: 'backend /user/renewjwt blocks invalid token', method: 'GET', url: `${bases.backend}/user/renewjwt`, token: 'invalid-token', expect: EXPECT_AUTH_BLOCKED },
  { name: 'backend /user/get/:id blocks missing token', method: 'GET', url: `${bases.backend}/user/get/security-smoke-user`, expect: EXPECT_AUTH_BLOCKED },
  { name: 'backend /message/me/userId/:id blocks missing token', method: 'GET', url: `${bases.backend}/message/me/userId/security-smoke-user`, expect: EXPECT_AUTH_BLOCKED },
  { name: 'backend /openai/moderate blocks missing token', method: 'POST', url: `${bases.backend}/openai/moderate`, body: { message: 'security smoke test' }, expect: EXPECT_AUTH_BLOCKED },
  { name: 'backend /utils/resolve blocks missing token', method: 'GET', url: `${bases.backend}/utils/resolve/${encodeURIComponent('https://example.com')}`, expect: EXPECT_AUTH_BLOCKED },

  { name: 'admin /user/me blocks missing token', method: 'GET', url: `${bases.admin}/user/me`, expect: EXPECT_AUTH_BLOCKED },
  { name: 'admin /user/me blocks public user JWT', method: 'GET', url: `${bases.admin}/user/me`, rawToken: makeUserJwt(), expect: EXPECT_AUTH_BLOCKED },
  { name: 'admin /user/me blocks wrong admin audience', method: 'GET', url: `${bases.admin}/user/me`, rawToken: adminTokenWrongAudience, expect: EXPECT_AUTH_BLOCKED },
  { name: 'admin /user/me blocks wrong admin issuer', method: 'GET', url: `${bases.admin}/user/me`, rawToken: adminTokenWrongIssuer, expect: EXPECT_AUTH_BLOCKED },
  { name: 'admin /user/me blocks expired admin token', method: 'GET', url: `${bases.admin}/user/me`, rawToken: expiredAdminToken, expect: EXPECT_AUTH_BLOCKED },
  { name: 'admin /ai/settings blocks missing token', method: 'GET', url: `${bases.admin}/ai/settings`, expect: EXPECT_AUTH_BLOCKED },
  { name: 'admin /maintenance blocks missing token', method: 'GET', url: `${bases.admin}/maintenance`, expect: EXPECT_AUTH_BLOCKED },

  { name: 'openMeteo /check blocks missing service token', method: 'POST', url: `${bases.openMeteo}/check`, expect: EXPECT_AUTH_BLOCKED },
  { name: 'openMeteo /check blocks public user JWT', method: 'POST', url: `${bases.openMeteo}/check`, rawToken: makeUserJwt(), expect: EXPECT_AUTH_BLOCKED },
  { name: 'nominatim /check blocks missing service token', method: 'POST', url: `${bases.nominatim}/check`, expect: EXPECT_AUTH_BLOCKED },
  { name: 'nominatim /check blocks public user JWT', method: 'POST', url: `${bases.nominatim}/check`, rawToken: makeUserJwt(), expect: EXPECT_AUTH_BLOCKED },
  { name: 'wikipedia /check blocks missing service token', method: 'POST', url: `${bases.wikipedia}/check`, expect: EXPECT_AUTH_BLOCKED },
  { name: 'wikipedia /check blocks public user JWT', method: 'POST', url: `${bases.wikipedia}/check`, rawToken: makeUserJwt(), expect: EXPECT_AUTH_BLOCKED },
  { name: 'socketio /emit/user blocks missing service token', method: 'POST', url: `${bases.socketio}/emit/user`, body: { userId: 'security-smoke-user', event: 'security-smoke', payload: {} }, expect: EXPECT_AUTH_BLOCKED },
  { name: 'viator non-public route blocks missing service token', method: 'GET', url: `${bases.viator}/viator/internal/security-smoke`, expect: EXPECT_AUTH_BLOCKED },
  { name: 'sticker /check blocks missing service token', method: 'POST', url: `${bases.sticker}/check`, expect: EXPECT_AUTH_BLOCKED },
  { name: 'sticker /sticker/bootstrap blocks missing service token', method: 'GET', url: `${bases.sticker}/sticker/bootstrap`, expect: EXPECT_AUTH_BLOCKED }
];

function hasNoStoreHeaders(res) {
  return String(res.headers['cache-control'] || '').toLowerCase().includes('no-store')
    && String(res.headers.pragma || '').toLowerCase() === 'no-cache'
    && String(res.headers.expires || '') === '0';
}

function hasPublicShortCacheHeaders(res) {
  const cacheControl = String(res.headers['cache-control'] || '').toLowerCase();
  return cacheControl.includes('public')
    && cacheControl.includes('max-age=3600')
    && !cacheControl.includes('no-store')
    && !cacheControl.includes('private');
}

function isJsonResponse(res) {
  return String(res.headers['content-type'] || '').toLowerCase().includes('application/json');
}

function authErrorDoesNotLeakDetails(res) {
  const body = String(res.body || '');
  return isJsonResponse(res)
    && !/<html/i.test(body)
    && !/stack/i.test(body)
    && !/jwt_secret/i.test(body)
    && !/admin_jwt_secret/i.test(body)
    && !/sqlite/i.test(body)
    && !/select\\s/i.test(body)
    && !/\/home\//i.test(body);
}

function responseDoesNotLeakDetails(res) {
  const body = String(res.body || '');
  return !/<html/i.test(body)
    && !/stack/i.test(body)
    && !/jwt_secret/i.test(body)
    && !/admin_jwt_secret/i.test(body)
    && !/sqlite/i.test(body)
    && !/select\\s/i.test(body)
    && !/\/home\//i.test(body);
}

function responseDoesNotLeakSensitiveRootDetails(res) {
  const body = String(res.body || '');
  return responseDoesNotLeakDetails(res)
    && !/secret/i.test(body)
    && !/api[_-]?key/i.test(body)
    && !/token/i.test(body)
    && !/password/i.test(body)
    && !/private[_-]?key/i.test(body);
}

const robotsSitemapTargets = [
  ['backend', bases.backend],
  ['admin', bases.admin],
  ['openMeteo', bases.openMeteo],
  ['nominatim', bases.nominatim],
  ['socketio', bases.socketio],
  ['viator', bases.viator],
  ['sticker', bases.sticker]
];

for (const [name, base] of robotsSitemapTargets) {
  tests.push(
    {
      name: `${name} /robots.txt returns disallow-all`,
      method: 'GET',
      url: `${base}/robots.txt`,
      expect: EXPECT_OK,
      assert: (res) => res.body.includes('Disallow: /') && hasPublicShortCacheHeaders(res)
    },
    {
      name: `${name} /sitemap.xml returns empty sitemap`,
      method: 'GET',
      url: `${base}/sitemap.xml`,
      expect: EXPECT_OK,
      assert: (res) => res.body.includes('<urlset')
        && res.body.includes('sitemaps.org/schemas/sitemap')
        && hasPublicShortCacheHeaders(res)
    }
  );
}

const headerTargets = [
  ['backend', bases.backend],
  ['admin', bases.admin],
  ['openMeteo', bases.openMeteo],
  ['nominatim', bases.nominatim],
  ['socketio', bases.socketio],
  ['viator', bases.viator],
  ['sticker', bases.sticker]
];

for (const [name, base] of headerTargets) {
  tests.push({
    name: `${name} exposes basic helmet security headers on /robots.txt`,
    method: 'GET',
    url: `${base}/robots.txt`,
    expect: EXPECT_OK,
    assert: (res) => {
      const poweredBy = res.headers['x-powered-by'];
      return !poweredBy
        && String(res.headers['x-content-type-options'] || '').toLowerCase() === 'nosniff'
        && String(res.headers['cross-origin-embedder-policy'] || '').toLowerCase() === 'require-corp'
        && hasPublicShortCacheHeaders(res)
        && Boolean(res.headers['content-security-policy']);
    }
  });
}

for (const [name, base] of headerTargets) {
  tests.push({
    name: `${name} root response has no-store cache headers`,
    method: 'GET',
    url: `${base}/`,
    expect: EXPECT_OK,
    assert: hasNoStoreHeaders
  });
}

tests.push(
  {
    name: 'backend CORS rejects untrusted origin',
    method: 'GET',
    url: `${bases.backend}/robots.txt`,
    headers: { origin: EVIL_ORIGIN },
    expect: EXPECT_OK,
    assert: (res) => !res.headers['access-control-allow-origin']
  },
  {
    name: 'admin CORS rejects untrusted origin',
    method: 'GET',
    url: `${bases.admin}/robots.txt`,
    headers: { origin: EVIL_ORIGIN },
    expect: EXPECT_OK,
    assert: (res) => !res.headers['access-control-allow-origin']
  },
  {
    name: 'socketio CORS rejects untrusted origin',
    method: 'GET',
    url: `${bases.socketio}/robots.txt`,
    headers: { origin: EVIL_ORIGIN },
    expect: EXPECT_OK,
    assert: (res) => !res.headers['access-control-allow-origin']
  },
  {
    name: 'backend CORS never returns wildcard origin',
    method: 'GET',
    url: `${bases.backend}/robots.txt`,
    headers: { origin: backendAllowedOrigin || EVIL_ORIGIN },
    expect: EXPECT_OK,
    assert: (res) => res.headers['access-control-allow-origin'] !== '*'
  },
  {
    name: 'admin CORS never returns wildcard origin',
    method: 'GET',
    url: `${bases.admin}/robots.txt`,
    headers: { origin: adminAllowedOrigin || EVIL_ORIGIN },
    expect: EXPECT_OK,
    assert: (res) => res.headers['access-control-allow-origin'] !== '*'
  },
  {
    name: 'socketio CORS never returns wildcard origin',
    method: 'GET',
    url: `${bases.socketio}/robots.txt`,
    headers: { origin: backendAllowedOrigin || EVIL_ORIGIN },
    expect: EXPECT_OK,
    assert: (res) => res.headers['access-control-allow-origin'] !== '*'
  }
);

if (backendAllowedOrigin) {
  tests.push({
    name: 'backend CORS preflight allows configured ORIGIN',
    method: 'OPTIONS',
    url: `${bases.backend}/user/renewjwt`,
    headers: {
      origin: backendAllowedOrigin,
      'access-control-request-method': 'GET',
      'access-control-request-headers': 'Authorization, Content-Type'
    },
    expect: EXPECT_OK,
    assert: (res) => res.headers['access-control-allow-origin'] === backendAllowedOrigin
      && String(res.headers['access-control-allow-credentials'] || '').toLowerCase() === 'true'
      && String(res.headers['access-control-allow-methods'] || '').includes('GET')
  });
}

if (adminAllowedOrigin) {
  tests.push({
    name: 'admin CORS preflight allows configured ADMIN_ORIGIN',
    method: 'OPTIONS',
    url: `${bases.admin}/user/me`,
    headers: {
      origin: adminAllowedOrigin,
      'access-control-request-method': 'GET',
      'access-control-request-headers': 'Authorization, Content-Type'
    },
    expect: EXPECT_OK,
    assert: (res) => res.headers['access-control-allow-origin'] === adminAllowedOrigin
      && String(res.headers['access-control-allow-credentials'] || '').toLowerCase() === 'true'
      && String(res.headers['access-control-allow-methods'] || '').includes('GET')
  });
}

tests.push(
  {
    name: 'backend CORS preflight rejects untrusted origin',
    method: 'OPTIONS',
    url: `${bases.backend}/user/renewjwt`,
    headers: {
      origin: EVIL_ORIGIN,
      'access-control-request-method': 'GET',
      'access-control-request-headers': 'Authorization, Content-Type'
    },
    expect: EXPECT_CORS_REJECTED,
    assert: (res) => !res.headers['access-control-allow-origin']
  },
  {
    name: 'admin CORS preflight rejects untrusted origin',
    method: 'OPTIONS',
    url: `${bases.admin}/user/me`,
    headers: {
      origin: EVIL_ORIGIN,
      'access-control-request-method': 'GET',
      'access-control-request-headers': 'Authorization, Content-Type'
    },
    expect: EXPECT_CORS_REJECTED,
    assert: (res) => !res.headers['access-control-allow-origin']
  }
);

if (backendAllowedOrigin) {
  tests.push({
    name: 'backend CORS allows configured ORIGIN',
    method: 'GET',
    url: `${bases.backend}/robots.txt`,
    headers: { origin: backendAllowedOrigin },
    expect: EXPECT_OK,
    assert: (res) => res.headers['access-control-allow-origin'] === backendAllowedOrigin
      && String(res.headers['access-control-allow-credentials'] || '').toLowerCase() === 'true'
  });
}

if (adminAllowedOrigin) {
  tests.push({
    name: 'admin CORS allows configured ADMIN_ORIGIN',
    method: 'GET',
    url: `${bases.admin}/robots.txt`,
    headers: { origin: adminAllowedOrigin },
    expect: EXPECT_OK,
    assert: (res) => res.headers['access-control-allow-origin'] === adminAllowedOrigin
      && String(res.headers['access-control-allow-credentials'] || '').toLowerCase() === 'true'
  });
}

const traceTargets = [
  ['backend', bases.backend],
  ['admin', bases.admin],
  ['openMeteo', bases.openMeteo],
  ['nominatim', bases.nominatim],
  ['socketio', bases.socketio],
  ['viator', bases.viator],
  ['sticker', bases.sticker]
];

const notFoundTargets = [
  ['backend', bases.backend],
  ['admin', bases.admin],
  ['openMeteo', bases.openMeteo],
  ['nominatim', bases.nominatim],
  ['socketio', bases.socketio],
  ['viator', bases.viator],
  ['sticker', bases.sticker]
];

for (const [name, base] of traceTargets) {
  tests.push({
    name: `${name} TRACE is not handled as success`,
    method: 'TRACE',
    url: `${base}/`,
    expect: EXPECT_NOT_FOUND_OR_METHOD_BLOCKED
  });
  tests.push({
    name: `${name} TRACK is not handled as success`,
    method: 'TRACK',
    url: `${base}/`,
    expect: EXPECT_METHOD_NOT_SUCCESS
  });
  tests.push({
    name: `${name} CONNECT is not handled as success`,
    method: 'CONNECT',
    url: `${base}/`,
    expect: EXPECT_METHOD_NOT_SUCCESS,
    allowNetworkError: /socket hang up|ECONNRESET/i
  });
}

for (const [name, base] of notFoundTargets) {
  tests.push({
    name: `${name} root response does not leak sensitive details`,
    method: 'GET',
    url: `${base}/`,
    expect: EXPECT_OK,
    assert: (res) => isJsonResponse(res)
      && hasNoStoreHeaders(res)
      && responseDoesNotLeakSensitiveRootDetails(res)
  });
}

const authErrorTargets = [
  ['backend user auth error', `${bases.backend}/user/renewjwt`, 'GET', undefined],
  ['backend invalid user token auth error', `${bases.backend}/user/renewjwt`, 'GET', 'invalid-token'],
  ['admin auth error', `${bases.admin}/user/me`, 'GET', undefined],
  ['admin invalid token auth error', `${bases.admin}/user/me`, 'GET', 'invalid-token'],
  ['openMeteo service auth error', `${bases.openMeteo}/check`, 'POST', undefined],
  ['nominatim service auth error', `${bases.nominatim}/check`, 'POST', undefined],
  ['socketio service auth error', `${bases.socketio}/emit/user`, 'POST', undefined, { userId: 'security-smoke-user', event: 'security-smoke', payload: {} }],
  ['sticker service auth error', `${bases.sticker}/check`, 'POST', undefined]
];

for (const [name, url, method, token, body] of authErrorTargets) {
  tests.push({
    name: `${name} is JSON, no-store and does not leak internals`,
    method,
    url,
    token,
    body,
    expect: EXPECT_AUTH_BLOCKED,
    assert: (res) => hasNoStoreHeaders(res) && authErrorDoesNotLeakDetails(res)
  });
}

for (const [name, base] of notFoundTargets) {
  tests.push({
    name: `${name} 404 response is JSON/no-store and does not leak internals`,
    method: 'GET',
    url: `${base}/security-smoke-definitely-not-existing`,
    expect: new Set([404]),
    assert: (res) => isJsonResponse(res) && hasNoStoreHeaders(res) && responseDoesNotLeakDetails(res)
  });
}

tests.push({
  name: 'backend invalid JSON returns 400 without stacktrace',
  method: 'POST',
  url: `${bases.backend}/openai/moderate`,
  rawToken: makeUserJwt(),
  rawBody: '{invalid',
  headers: { 'content-type': 'application/json' },
  expect: EXPECT_BAD_REQUEST,
  assert: (res) => isJsonResponse(res) && hasNoStoreHeaders(res) && responseDoesNotLeakDetails(res)
});

const concreteServiceRouteTargets = [
  ['openMeteo weather route blocks missing service token', `${bases.openMeteo}/weather/en/TESTPLUS/52.52/13.405/1`],
  ['openMeteo airquality route blocks missing service token', `${bases.openMeteo}/airquality/TESTPLUS/52.52/13.405/1`],
  ['nominatim search route blocks missing service token', `${bases.nominatim}/nominatim/search/Berlin/1`],
  ['wikipedia nearby route blocks missing service token', `${bases.wikipedia}/wikipedia/nearby?north=52.52&south=52.51&east=13.41&west=13.39&zoom=14&language=de`],
  ['wikipedia attribution route blocks missing service token', `${bases.wikipedia}/wikipedia/attribution?pageId=8159759&title=Donnerburgbr%C3%BCcke&language=de`],
  ['sticker categories route blocks missing service token', `${bases.sticker}/sticker/categories`],
  ['sticker search route blocks missing service token', `${bases.sticker}/sticker/search?q=cat`]
];

for (const [name, url] of concreteServiceRouteTargets) {
  tests.push({
    name,
    method: 'GET',
    url,
    expect: EXPECT_AUTH_BLOCKED,
    assert: (res) => hasNoStoreHeaders(res) && authErrorDoesNotLeakDetails(res)
  });
}

function request({ method, url, token, rawToken, headers = {}, body, rawBody, timeoutMs = 5000 }) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload = rawBody !== undefined
      ? Buffer.from(String(rawBody))
      : (body === undefined ? null : Buffer.from(JSON.stringify(body)));
    const requestHeaders = { ...headers };
    if (payload && !requestHeaders['content-type'] && !requestHeaders['Content-Type']) {
      requestHeaders['content-type'] = 'application/json';
    }
    if (payload) {
      requestHeaders['content-length'] = String(payload.length);
    }
    if (rawToken || token) {
      requestHeaders.authorization = `Bearer ${rawToken || token}`;
    }

    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.request({
      method,
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port,
      path: `${parsed.pathname}${parsed.search}`,
      headers: requestHeaders,
      timeout: timeoutMs
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
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
      const assertionOk = ok && (typeof test.assert !== 'function' || test.assert(response));
      const marker = assertionOk ? 'PASS' : 'FAIL';
      console.log(`${marker} ${test.name} -> ${response.statusCode}`);
      if (!assertionOk) {
        failures.push({ test, response });
      }
    } catch (error) {
      const networkErrorAllowed = test.allowNetworkError instanceof RegExp
        && test.allowNetworkError.test(String(error?.message || ''));
      const marker = networkErrorAllowed ? 'PASS' : 'FAIL';
      console.log(`${marker} ${test.name} -> ${error.message}`);
      if (!networkErrorAllowed) {
        failures.push({ test, error });
      }
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
