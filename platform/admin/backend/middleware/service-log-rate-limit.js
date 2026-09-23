const { verifyServiceJwt } = require('../utils/serviceJwt');

const verifiedRequests = new WeakMap();
const logPaths = new Set(['/info-log', '/warn-log', '/error-log']);

// Only authenticated service log ingestion bypasses the browser/IP budgets.
// Never trust an IP, a source field, or an unverified JWT for this exception.
function isServiceLogIngestion(req) {
  if (req.method !== 'POST' || !logPaths.has(req.path.replace(/\/$/, ''))) return false;
  if (verifiedRequests.has(req)) return verifiedRequests.get(req);
  const token = req.headers?.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  let verified = false;
  if (token) {
    try {
      verifyServiceJwt(token, {
        audience: process.env.SERVICE_JWT_AUDIENCE || 'service.admin-backend'
      });
      verified = true;
    } catch { /* Invalid and browser tokens remain rate limited. */ }
  }
  verifiedRequests.set(req, verified);
  return verified;
}

// Capture the full path before Express trims the mounted /info-log prefix.
function identifyServiceLogIngestion(req, _res, next) {
  isServiceLogIngestion(req);
  next();
}

function skipServiceLogIngestion(req) {
  return verifiedRequests.get(req) === true;
}

module.exports = { identifyServiceLogIngestion, skipServiceLogIngestion };
