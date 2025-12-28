const STATUS_TO_ERROR_CODE = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  408: 'REQUEST_TIMEOUT',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'RATE_LIMIT',
  500: 'INTERNAL_ERROR',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE',
  504: 'GATEWAY_TIMEOUT'
};

const STATUS_TO_MESSAGE = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  408: 'request_timeout',
  409: 'conflict',
  413: 'payload_too_large',
  415: 'unsupported_media_type',
  422: 'unprocessable_entity',
  429: 'rate_limit',
  500: 'unexpected_error',
  502: 'bad_gateway',
  503: 'service_unavailable',
  504: 'gateway_timeout'
};

function errorCodeFromStatus(status) {
  return STATUS_TO_ERROR_CODE[status] || 'INTERNAL_ERROR';
}

function defaultMessageFromStatus(status) {
  return STATUS_TO_MESSAGE[status] || 'unexpected_error';
}

function extractMessage(payload, status) {
  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }
  if (payload && typeof payload === 'object') {
    if (typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message;
    }
    if (typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error;
    }
  }
  return defaultMessageFromStatus(status);
}

function normalizeErrorPayload(status, payload) {
  const normalizedStatus = Number(status) || 500;
  const message = extractMessage(payload, normalizedStatus);
  const normalized = (payload && typeof payload === 'object' && !Array.isArray(payload)) ? { ...payload } : {};
  const errorCode = typeof normalized.errorCode === 'string'
    ? normalized.errorCode
    : errorCodeFromStatus(normalizedStatus);

  normalized.errorCode = errorCode;
  if (typeof normalized.status !== 'number') {
    normalized.status = normalizedStatus;
  }
  normalized.message = typeof normalized.message === 'string' && normalized.message.trim()
    ? normalized.message
    : message;
  normalized.error = typeof normalized.error === 'string' && normalized.error.trim()
    ? normalized.error
    : normalized.message;

  if (typeof normalized.error !== 'string') {
    normalized.error = normalized.message;
  }
  if (normalized.stack) {
    delete normalized.stack;
  }

  return normalized;
}

function normalizeErrorResponses(_req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 400) {
      return originalJson(normalizeErrorPayload(res.statusCode, body));
    }
    return originalJson(body);
  };
  next();
}

function notFoundHandler(_req, res) {
  res.status(404).json({ error: 'not_found' });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  const status = err?.status || err?.statusCode || 500;
  const payload = normalizeErrorPayload(status, err);

  if (status >= 500) {
    req?.logger?.error?.('Unhandled error', { message: err?.message, stack: err?.stack });
  } else {
    req?.logger?.warn?.('Request error', { message: err?.message || payload.message });
  }

  res.status(status).json(payload);
}

module.exports = {
  normalizeErrorResponses,
  notFoundHandler,
  errorHandler,
  normalizeErrorPayload
};
