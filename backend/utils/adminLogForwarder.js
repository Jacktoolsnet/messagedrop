const axios = require('axios');
const { signServiceJwt } = require('./serviceJwt');

function safeStringify(value) {
  const seen = new WeakSet();
  try {
    return JSON.stringify(value, (_key, current) => {
      if (typeof current === 'bigint') return current.toString();
      if (current instanceof Error) {
        return {
          name: current.name,
          message: current.message,
          stack: current.stack,
          code: current.code,
          status: current.status
        };
      }
      if (typeof current === 'object' && current !== null) {
        if (seen.has(current)) return '[Circular]';
        seen.add(current);
      }
      return current;
    });
  } catch {
    try {
      return String(value);
    } catch {
      return '[Unserializable]';
    }
  }
}

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

function formatDetail(meta) {
  if (!meta || typeof meta !== 'object') {
    return null;
  }
  try {
    return safeStringify(meta);
  } catch {
    return String(meta);
  }
}

function createForwarder({ baseUrl, token, audience, source }) {
  if (!baseUrl) {
    return () => { /* disabled */ };
  }
  const post = async (path, payload) => {
    try {
      let authHeader = null;
      if (audience) {
        const jwtToken = await signServiceJwt({ audience });
        authHeader = `Bearer ${jwtToken}`;
      } else if (token) {
        authHeader = `Bearer ${token}`;
      }
      await axios.post(`${baseUrl}${path}`, payload, {
        headers: authHeader ? { Authorization: authHeader } : undefined,
        timeout: 2000,
        validateStatus: () => true
      });
    } catch {
      // swallow to avoid log loops
    }
  };

  return (level, message, meta) => {
    const file = getCallerFile();
    const detail = formatDetail(meta);
    const body = {
      source: source || 'backend',
      file,
      message: typeof message === 'string' ? message : safeStringify(message),
      detail,
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
  const forward = createForwarder(opts);
  ['info', 'warn', 'error'].forEach(level => {
    const orig = logger[level]?.bind(logger);
    if (!orig) return;
    logger[level] = (...args) => {
      orig(...args);
      forward(level, args[0], args[1]);
    };
  });
}

module.exports = {
  resolveBaseUrl,
  attachForwarding
};
