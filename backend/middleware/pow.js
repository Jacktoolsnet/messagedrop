const crypto = require('crypto');
const axios = require('axios');
const { resolveBaseUrl } = require('../utils/adminLogForwarder');
const { signServiceJwt } = require('../utils/serviceJwt');

const POW_SECRET = process.env.POW_SECRET || process.env.JWT_SECRET || '';
const POW_TTL_MS = Number(process.env.POW_TTL_MS || 2 * 60 * 1000);
const POW_DIFFICULTY = Number(process.env.POW_DIFFICULTY || 12);
const POW_MAX_DIFFICULTY = Number(process.env.POW_MAX_DIFFICULTY || 20);
const POW_WINDOW_MS = Number(process.env.POW_WINDOW_MS || 5 * 60 * 1000);
const POW_THRESHOLD = Number(process.env.POW_THRESHOLD || 20);
const POW_SUSPICIOUS_THRESHOLD = Number(process.env.POW_SUSPICIOUS_THRESHOLD || 10);
const POW_REQUIRE_TTL_MS = Number(process.env.POW_REQUIRE_TTL_MS || 10 * 60 * 1000);

const hits = new Map();

const suspiciousUaFragments = ['bot', 'spider', 'crawl', 'curl', 'python', 'httpclient', 'scrapy', 'wget'];

function cleanupHits() {
  const now = Date.now();
  for (const [key, entry] of hits.entries()) {
    if (now - entry.windowStart >= POW_WINDOW_MS && (!entry.requiredUntil || entry.requiredUntil < now)) {
      hits.delete(key);
    }
  }
}

setInterval(cleanupHits, Math.max(POW_WINDOW_MS, 60 * 1000)).unref();

function normalizeUserAgent(ua) {
  if (!ua || typeof ua !== 'string') return '';
  return ua.trim();
}

function isSuspiciousUserAgent(ua) {
  const normalized = normalizeUserAgent(ua).toLowerCase();
  if (!normalized) return true;
  return suspiciousUaFragments.some(fragment => normalized.includes(fragment));
}

function getKey(req) {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const ua = normalizeUserAgent(req.get('user-agent'));
  return `${ip}|${ua || 'missing'}`;
}

function getEntry(key, now) {
  const existing = hits.get(key);
  if (!existing || now - existing.windowStart >= POW_WINDOW_MS) {
    const entry = {
      windowStart: now,
      count: 0,
      requiredUntil: 0,
      loggedAt: 0
    };
    hits.set(key, entry);
    return entry;
  }
  return existing;
}

function countLeadingZeroBits(bytes) {
  let zeros = 0;
  for (const byte of bytes) {
    if (byte === 0) {
      zeros += 8;
      continue;
    }
    zeros += Math.clz32(byte) - 24;
    break;
  }
  return zeros;
}

function signChallenge(payload) {
  return crypto.createHmac('sha256', POW_SECRET).update(payload).digest('hex');
}

function createChallenge(scope, difficulty) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const ts = Date.now();
  const ttl = POW_TTL_MS;
  const payload = `${nonce}.${ts}.${ttl}.${difficulty}.${scope}`;
  const signature = signChallenge(payload);
  return { nonce, ts, ttl, difficulty, signature, scope };
}

function parsePowHeader(header) {
  if (!header || typeof header !== 'string') return null;
  const parts = header.split(':');
  if (parts.length !== 6) return null;
  const [nonce, tsRaw, ttlRaw, diffRaw, solution, signature] = parts;
  const ts = Number(tsRaw);
  const ttl = Number(ttlRaw);
  const difficulty = Number(diffRaw);
  if (!nonce || !solution || !signature) return null;
  if (!Number.isFinite(ts) || !Number.isFinite(ttl) || !Number.isFinite(difficulty)) return null;
  return { nonce, ts, ttl, difficulty, solution, signature };
}

function verifyPow(headerValue, scope) {
  if (!POW_SECRET) return false;
  const parsed = parsePowHeader(headerValue);
  if (!parsed) return false;
  const { nonce, ts, ttl, difficulty, solution, signature } = parsed;
  if (!scope || difficulty > POW_MAX_DIFFICULTY || difficulty <= 0) return false;
  const now = Date.now();
  if (now - ts > ttl) return false;
  const payload = `${nonce}.${ts}.${ttl}.${difficulty}.${scope}`;
  const expectedSig = signChallenge(payload);
  if (signature.length !== expectedSig.length) {
    return false;
  }
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    return false;
  }
  const hash = crypto.createHash('sha256').update(`${nonce}.${solution}.${scope}`).digest();
  return countLeadingZeroBits(hash) >= difficulty;
}

function shouldRequirePow(req, scope, opts) {
  if (!POW_SECRET) return { required: false };
  const now = Date.now();
  const key = getKey(req);
  const entry = getEntry(key, now);
  entry.count += 1;
  const ua = normalizeUserAgent(req.get('user-agent'));
  const threshold = isSuspiciousUserAgent(ua)
    ? (opts.suspiciousThreshold || POW_SUSPICIOUS_THRESHOLD)
    : (opts.threshold || POW_THRESHOLD);

  if (entry.count >= threshold && entry.requiredUntil < now) {
    entry.requiredUntil = now + (opts.requireTtlMs || POW_REQUIRE_TTL_MS);
    entry.loggedAt = 0;
  }

  const required = entry.requiredUntil > now;
  const newlyRequired = required && !entry.loggedAt;
  if (newlyRequired) {
    entry.loggedAt = now;
  }

  return { required, newlyRequired, requiredUntil: entry.requiredUntil, key };
}

async function forwardPowLog(payload) {
  const adminBase = resolveBaseUrl(process.env.ADMIN_BASE_URL, process.env.ADMIN_PORT, process.env.ADMIN_LOG_URL);
  if (!adminBase) return;
  try {
    const token = await signServiceJwt({
      audience: process.env.SERVICE_JWT_AUDIENCE_ADMIN || 'service.admin-backend'
    });
    await axios.post(`${adminBase}/pow-log`, payload, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 2000,
      validateStatus: () => true
    });
  } catch {
    // swallow to avoid feedback loops
  }
}

function createPowGuard(opts) {
  const scope = opts?.scope || 'unknown';
  const difficulty = Math.min(opts?.difficulty || POW_DIFFICULTY, POW_MAX_DIFFICULTY);
  return (req, res, next) => {
    const decision = shouldRequirePow(req, scope, opts || {});
    if (decision.required) {
      const powHeader = req.get('x-pow');
      if (powHeader && verifyPow(powHeader, scope)) {
        return next();
      }
      const challenge = createChallenge(scope, difficulty);
      if (decision.newlyRequired) {
        const ip = req.ip || req.connection?.remoteAddress || 'unknown';
        const userAgent = normalizeUserAgent(req.get('user-agent'));
        const payload = {
          source: 'backend',
          scope,
          path: req.originalUrl || req.path,
          method: req.method,
          ip,
          userAgent,
          reason: 'threshold_exceeded',
          difficulty,
          requiredUntil: decision.requiredUntil,
          createdAt: Date.now()
        };
        void forwardPowLog(payload);
      }
      return res.status(428).json({
        errorCode: 'POW_REQUIRED',
        message: 'pow_required',
        challenge
      });
    }
    return next();
  };
}

module.exports = {
  createPowGuard,
  verifyPow
};
