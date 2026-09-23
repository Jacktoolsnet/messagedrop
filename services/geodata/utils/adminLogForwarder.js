const axios = require('axios');
const { signServiceJwt } = require('./serviceJwt');

function resolveBaseUrl(envBase, envPort, fallback) {
  if (fallback) return fallback.replace(/\/+$/, '');
  const base = (envBase || '').replace(/\/+$/, '');
  if (!base) return null;
  return envPort ? `${base}:${envPort}` : base;
}

function getCallerFile() {
  const err = new Error();
  const stack = (err.stack || '').split('\n').slice(3);
  for (const line of stack) {
    const match = line.match(/\((.*):\d+:\d+\)$/) || line.match(/at (.*):\d+:\d+$/);
    const file = match?.[1];
    if (file && !file.includes('adminLogForwarder')) {
      return file;
    }
  }
  return 'unknown';
}

function formatForwardMessage(args) {
  const [message, ...metadata] = args;
  const base = typeof message === 'string' ? message : JSON.stringify(message);
  if (metadata.length === 0) return base;
  const context = metadata.length === 1 ? metadata[0] : metadata;
  try {
    return `${base} ${JSON.stringify(context, (_key, value) => value instanceof Error
      ? { name: value.name, message: value.message, stack: value.stack }
      : value)}`;
  } catch {
    return `${base} ${String(context)}`;
  }
}

function createForwarder({ baseUrl, token, audience, source, onFailure = () => {} }) {
  if (!baseUrl) {
    return () => { /* disabled */ };
  }
  // Local files retain every log; forwarding must not create unbounded HTTP work.
  let pending = 0;
  const waiting = [];
  let blockedUntil = 0;
  let lastWarning = 0;
  const report = (reason) => {
    if (Date.now() - lastWarning < 30000) return;
    lastWarning = Date.now();
    try { onFailure(reason); } catch { /* Logging must not interrupt imports. */ }
  };
  const post = async (path, payload) => {
    if (Date.now() < blockedUntil) {
      report('Admin log forwarding skipped: rate limited; full logs remain in local files.');
      return;
    }
    if (pending >= 4) {
      if (waiting.length < 200) waiting.push([path, payload]);
      else report('Admin log forwarding queue full; full logs remain in local files.');
      return;
    }
    pending++;

    try {
      let authHeader = null;
      if (audience) {
        const jwtToken = await signServiceJwt({ audience });
        authHeader = `Bearer ${jwtToken}`;
      } else if (token) {
        authHeader = `Bearer ${token}`;
      }
      const response = await axios.post(`${baseUrl}${path}`, payload, {
        headers: authHeader ? { Authorization: authHeader } : undefined,
        timeout: 2000,
        validateStatus: () => true
      });
      if (response.status === 429) {
        waiting.length = 0;
        const retryAfter = response.headers?.['retry-after'];
        const seconds = Number(retryAfter);
        const delay = retryAfter && !Number.isFinite(seconds)
          ? Date.parse(retryAfter) - Date.now() : seconds * 1000;
        blockedUntil = Date.now() + (Number.isFinite(delay) && delay > 0 ? Math.min(delay, 3600000) : 60000);
      }
      if (response.status >= 400) report(`Admin log forwarding failed (HTTP ${response.status}); full logs remain in local files.`);
    } catch {
      report('Admin log forwarding unavailable; full logs remain in local files.');
    } finally {
      pending--;
      if (waiting.length) void post(...waiting.shift()).catch(() => {});
    }
  };

  return (level, message) => {
    const file = getCallerFile();
    const body = {
      source: source || 'nominatim-service',
      file,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      createdAt: Date.now()
    };
    if (level === 'error') {
      return post('/error-log', body);
    }
    if (level === 'warn') {
      return post('/warn-log', body);
    }
    return post('/info-log', body);
  };
}

function attachForwarding(logger, opts) {
  const localWarn = logger.warn?.bind(logger);
  const forward = createForwarder({ ...opts, onFailure: message => localWarn?.(message) });
  ['info', 'warn', 'error'].forEach(level => {
    const orig = logger[level]?.bind(logger);
    if (!orig) return;
    logger[level] = (...args) => {
      orig(...args);
      try {
        void Promise.resolve(forward(level, formatForwardMessage(args))).catch(() => {});
      } catch { /* Forwarding/serialization must never break the caller. */ }
    };
  });
}

module.exports = {
  resolveBaseUrl,
  attachForwarding,
  formatForwardMessage
};
