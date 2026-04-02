const { apiError } = require('../middleware/api-error');

function readHeader(headers, name) {
  if (!headers || !name) {
    return null;
  }

  if (typeof headers.get === 'function') {
    const value = headers.get(name);
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  if (typeof headers !== 'object') {
    return null;
  }

  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === String(name).toLowerCase());
  if (!key) {
    return null;
  }

  const value = headers[key];
  if (Array.isArray(value)) {
    const first = value.find((entry) => typeof entry === 'string' && entry.trim());
    return first ? first.trim() : null;
  }

  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeMessage(error) {
  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function parseRetryAfterMs(headers) {
  const retryAfterMs = readHeader(headers, 'retry-after-ms');
  if (retryAfterMs) {
    const parsed = Number.parseFloat(retryAfterMs);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.round(parsed);
    }
  }

  const retryAfter = readHeader(headers, 'retry-after');
  if (!retryAfter) {
    return null;
  }

  const seconds = Number.parseFloat(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }

  const absolute = Date.parse(retryAfter);
  if (!Number.isFinite(absolute)) {
    return null;
  }

  return Math.max(0, absolute - Date.now());
}

function buildOpenAiErrorDetail(error, options = {}) {
  const headers = error?.headers;
  const detail = {
    provider: 'openai',
    operation: typeof options.operation === 'string' && options.operation.trim() ? options.operation.trim() : undefined,
    model: typeof options.model === 'string' && options.model.trim() ? options.model.trim() : undefined,
    name: typeof error?.name === 'string' && error.name.trim() ? error.name.trim() : undefined,
    status: Number.isFinite(error?.status) ? error.status : undefined,
    code: typeof error?.code === 'string' && error.code.trim() ? error.code.trim() : undefined,
    type: typeof error?.type === 'string' && error.type.trim() ? error.type.trim() : undefined,
    param: typeof error?.param === 'string' && error.param.trim() ? error.param.trim() : undefined,
    requestId: typeof error?.requestID === 'string' && error.requestID.trim()
      ? error.requestID.trim()
      : readHeader(headers, 'x-request-id') || undefined,
    retryAfter: readHeader(headers, 'retry-after') || undefined,
    retryAfterMs: parseRetryAfterMs(headers) ?? undefined,
    upstreamMessage: normalizeMessage(error)
  };

  return Object.fromEntries(
    Object.entries(detail).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}

function createOpenAiApiError(error, options = {}) {
  const message = typeof options.message === 'string' && options.message.trim()
    ? options.message.trim()
    : 'openai_failed';

  const status = Number.isFinite(error?.status) ? error.status : null;
  let apiErr;

  if (status === 429) {
    apiErr = apiError.rateLimit(message);
  } else if (status === 408 || error?.name === 'APIConnectionTimeoutError') {
    apiErr = apiError.gatewayTimeout(message);
  } else if (status === 401 || status === 403 || error?.name === 'APIConnectionError') {
    apiErr = apiError.serviceUnavailable(message);
  } else if (status >= 400 && status < 600) {
    apiErr = apiError.badGateway(message);
  } else {
    apiErr = apiError.internal(message);
  }

  apiErr.detail = buildOpenAiErrorDetail(error, options);
  return apiErr;
}

module.exports = {
  buildOpenAiErrorDetail,
  createOpenAiApiError
};
