const fs = require('fs');
const jwt = require('jsonwebtoken');
const { createPrivateKey, createPublicKey, webcrypto } = require('crypto');
const { getSigningPrivateKey } = require('./keyStore');

const DEFAULT_TTL_SECONDS = 120;

let cachedPrivateKey = null;
let cachedTrustedJwks = null;
const trustedKeyCache = new Map();

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

async function signServiceJwt({ audience, subject, ttlSeconds = DEFAULT_TTL_SECONDS, extraClaims = {} } = {}) {
  const issuer = process.env.SERVICE_JWT_ISSUER;
  if (!issuer) {
    throw new Error('SERVICE_JWT_ISSUER is not set');
  }
  if (!audience) {
    throw new Error('Service JWT audience is required');
  }
  const key = await getPrivateKeyObject();
  const payload = { ...extraClaims };
  if (subject) {
    payload.sub = subject;
  }
  return jwt.sign(payload, key, {
    algorithm: 'ES384',
    issuer,
    audience,
    expiresIn: ttlSeconds
  });
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
