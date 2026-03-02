const fs = require('fs');
const jwt = require('jsonwebtoken');
const { createPrivateKey, createPublicKey, webcrypto } = require('crypto');
const { getSigningPrivateKey } = require('./keyStore');

const DEFAULT_TTL_SECONDS = 120;
const MIN_TOKEN_TTL_MS = 15000;

let cachedPrivateKey = null;
let cachedTrustedJwks = null;
const trustedKeyCache = new Map();
const signedTokenCache = new Map();
const tokenSignInFlight = new Map();

function loadTrustedJwks() {
  if (cachedTrustedJwks) {
    return cachedTrustedJwks;
  }
  let raw = process.env.SERVICE_JWT_TRUSTED_JWKS || '';
  const path = process.env.SERVICE_JWT_TRUSTED_JWKS_PATH;
  if (path && fs.existsSync(path)) {
    raw = fs.readFileSync(path, 'utf8');
  }
  if (!raw) {
    cachedTrustedJwks = {};
    return cachedTrustedJwks;
  }
  try {
    cachedTrustedJwks = JSON.parse(raw);
  } catch {
    cachedTrustedJwks = {};
  }
  return cachedTrustedJwks;
}

function getTrustedPublicKey(issuer) {
  if (trustedKeyCache.has(issuer)) {
    return trustedKeyCache.get(issuer);
  }
  const jwks = loadTrustedJwks();
  const entry = jwks?.[issuer];
  if (!entry) return null;
  const jwk = typeof entry === 'string' ? JSON.parse(entry) : entry;
  const key = createPublicKey({ key: jwk, format: 'jwk' });
  trustedKeyCache.set(issuer, key);
  return key;
}

async function getPrivateKeyObject() {
  if (cachedPrivateKey) return cachedPrivateKey;
  const cryptoKey = getSigningPrivateKey();
  if (!cryptoKey) {
    throw new Error('Signing key not loaded');
  }
  const jwk = await webcrypto.subtle.exportKey('jwk', cryptoKey);
  cachedPrivateKey = createPrivateKey({ key: jwk, format: 'jwk' });
  return cachedPrivateKey;
}

function cleanupExpiredTokenCache(nowMs = Date.now()) {
  for (const [cacheKey, cacheEntry] of signedTokenCache.entries()) {
    if (!cacheEntry || cacheEntry.expiresAtMs <= nowMs) {
      signedTokenCache.delete(cacheKey);
    }
  }
}

function serializeExtraClaims(extraClaims = {}) {
  const entries = Object.entries(extraClaims || {});
  if (entries.length === 0) {
    return '';
  }
  entries.sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([key, value]) => `${key}:${JSON.stringify(value)}`).join('|');
}

function buildTokenCacheKey({ audience, subject, ttlSeconds, extraClaims }) {
  return [
    audience || '',
    subject || '',
    String(ttlSeconds || DEFAULT_TTL_SECONDS),
    serializeExtraClaims(extraClaims)
  ].join('§');
}

function getCachedServiceToken(cacheKey) {
  const cached = signedTokenCache.get(cacheKey);
  if (!cached?.token || !Number.isFinite(cached.expiresAtMs)) {
    return null;
  }
  const remainingMs = cached.expiresAtMs - Date.now();
  if (remainingMs <= MIN_TOKEN_TTL_MS) {
    signedTokenCache.delete(cacheKey);
    return null;
  }
  return cached.token;
}

function cacheSignedToken(cacheKey, token, ttlSeconds) {
  const decoded = jwt.decode(token);
  const expMs = Number(decoded?.exp) * 1000;
  const fallbackExpMs = Date.now() + Number(ttlSeconds || DEFAULT_TTL_SECONDS) * 1000;
  const expiresAtMs = Number.isFinite(expMs) ? expMs : fallbackExpMs;
  signedTokenCache.set(cacheKey, { token, expiresAtMs });
}

async function signServiceJwt({ audience, subject, ttlSeconds = DEFAULT_TTL_SECONDS, extraClaims = {} } = {}) {
  const issuer = process.env.SERVICE_JWT_ISSUER;
  if (!issuer) {
    throw new Error('SERVICE_JWT_ISSUER is not set');
  }
  if (!audience) {
    throw new Error('Service JWT audience is required');
  }

  cleanupExpiredTokenCache();
  const cacheKey = buildTokenCacheKey({ audience, subject, ttlSeconds, extraClaims });
  const cachedToken = getCachedServiceToken(cacheKey);
  if (cachedToken) {
    return cachedToken;
  }
  const inFlight = tokenSignInFlight.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const signPromise = (async () => {
    const key = await getPrivateKeyObject();
    const payload = { ...extraClaims };
    if (subject) {
      payload.sub = subject;
    }
    const token = jwt.sign(payload, key, {
      algorithm: 'ES384',
      issuer,
      audience,
      expiresIn: ttlSeconds
    });
    cacheSignedToken(cacheKey, token, ttlSeconds);
    return token;
  })();

  tokenSignInFlight.set(cacheKey, signPromise);
  try {
    return await signPromise;
  } finally {
    tokenSignInFlight.delete(cacheKey);
  }
}

function verifyServiceJwt(token, { audience } = {}) {
  const decoded = jwt.decode(token);
  const issuer = decoded?.iss;
  if (!issuer) {
    throw new Error('Missing issuer in service token');
  }
  const key = getTrustedPublicKey(issuer);
  if (!key) {
    throw new Error(`Untrusted issuer: ${issuer}`);
  }
  const expectedAudience = audience || process.env.SERVICE_JWT_AUDIENCE;
  return jwt.verify(token, key, {
    algorithms: ['ES384'],
    issuer,
    audience: expectedAudience
  });
}

function extractBearerToken(req) {
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.trim()) {
    return auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  }
  return null;
}

function requireServiceJwt(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({
      errorCode: 'UNAUTHORIZED',
      message: 'missing_service_token',
      error: 'missing_service_token'
    });
  }
  try {
    req.service = verifyServiceJwt(token);
    return next();
  } catch {
    return res.status(403).json({
      errorCode: 'UNAUTHORIZED',
      message: 'invalid_service_token',
      error: 'invalid_service_token'
    });
  }
}

module.exports = {
  signServiceJwt,
  verifyServiceJwt,
  requireServiceJwt
};
