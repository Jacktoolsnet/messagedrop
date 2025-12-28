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

function createApiError(status, message, errorCode) {
  const normalizedStatus = Number(status) || 500;
  const normalizedMessage = message || defaultMessageFromStatus(normalizedStatus);
  const err = new Error(normalizedMessage);
  err.status = normalizedStatus;
  err.statusCode = normalizedStatus;
  err.errorCode = errorCode || errorCodeFromStatus(normalizedStatus);
  return err;
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

function attachTraceId(payload, req, res) {
  const traceId = req?.traceId || res?.locals?.traceId;
  if (traceId && typeof payload.traceId !== 'string') {
    payload.traceId = traceId;
  }
}

function normalizeErrorResponses(_req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 400) {
      const payload = normalizeErrorPayload(res.statusCode, body);
      attachTraceId(payload, null, res);
      return originalJson(payload);
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
  attachTraceId(payload, req, res);

  if (status >= 500) {
    req?.logger?.error?.('Unhandled error', { traceId: payload.traceId, message: err?.message, stack: err?.stack });
  } else {
    req?.logger?.warn?.('Request error', { traceId: payload.traceId, message: err?.message || payload.message });
  }

  res.status(status).json(payload);
}

module.exports = {
  createApiError,
  apiError: {
    badRequest: (message) => createApiError(400, message, 'BAD_REQUEST'),
    unauthorized: (message) => createApiError(401, message, 'UNAUTHORIZED'),
    forbidden: (message) => createApiError(403, message, 'FORBIDDEN'),
    notFound: (message) => createApiError(404, message, 'NOT_FOUND'),
    conflict: (message) => createApiError(409, message, 'CONFLICT'),
    payloadTooLarge: (message) => createApiError(413, message, 'PAYLOAD_TOO_LARGE'),
    unsupportedMediaType: (message) => createApiError(415, message, 'UNSUPPORTED_MEDIA_TYPE'),
    unprocessableEntity: (message) => createApiError(422, message, 'UNPROCESSABLE_ENTITY'),
    rateLimit: (message) => createApiError(429, message, 'RATE_LIMIT'),
    internal: (message) => createApiError(500, message, 'INTERNAL_ERROR'),
    badGateway: (message) => createApiError(502, message, 'BAD_GATEWAY'),
    serviceUnavailable: (message) => createApiError(503, message, 'SERVICE_UNAVAILABLE'),
    gatewayTimeout: (message) => createApiError(504, message, 'GATEWAY_TIMEOUT'),
    custom: (status, errorCode, message) => createApiError(status, message, errorCode),
    fromStatus: (status, message) => createApiError(status, message)
  },
  normalizeErrorResponses,
  notFoundHandler,
  errorHandler,
  normalizeErrorPayload
};
