const crypto = require('crypto');

const TRACE_ID_REGEX = /^[a-zA-Z0-9_-]{8,128}$/;

function getIncomingTraceId(req) {
  const raw = req.get('x-request-id') || req.get('x-trace-id');
  if (!raw) {
    return null;
  }
  const cleaned = String(raw).trim();
  return TRACE_ID_REGEX.test(cleaned) ? cleaned : null;
}

function generateTraceId() {
  return crypto.randomBytes(16).toString('hex');
}

module.exports = function traceId() {
  return function (req, res, next) {
    const traceId = getIncomingTraceId(req) || generateTraceId();
    req.traceId = traceId;
    res.locals.traceId = traceId;
    res.setHeader('X-Trace-Id', traceId);
    next();
  };
};
