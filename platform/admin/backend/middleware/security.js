// middleware/security.js
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { requireServiceJwt, verifyServiceJwt } = require('../utils/serviceJwt');

function extractBearerFromHeader(req) {
  const auth = req.headers?.authorization;
  if (typeof auth !== 'string') {
    return null;
  }
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return null;
  }
  const token = match[1]?.trim();
  return token || null;
}

/**
 * Optionales User-JWT für Public-Routen.
 * - Nutzt ausschließlich Authorization: Bearer <token>
 * - Verifiziert gegen PUBLIC_* (iss/aud/secret), wenn vorhanden
 * - Bei Fehlern oder ohne Token: req.jwtUser bleibt undefined
 */
function authenticateOptionalUser(req, _res, next) {
  const token = extractBearerFromHeader(req);
  if (!token) return next();

  try {
    const payload = jwt.verify(token, process.env.PUBLIC_JWT_SECRET, {
      algorithms: ['HS256'],
      audience: process.env.PUBLIC_AUD || 'messagedrop-frontend',
      issuer: process.env.PUBLIC_ISS || 'https://auth.messagedrop.app/'
    });
    req.jwtUser = payload; // { sub, email, roles?, ... }
  } catch {
    // absichtlich still → anonym zulassen
  }
  next();
}

function verifyAdminJwt(token) {
  return jwt.verify(token, process.env.ADMIN_JWT_SECRET, {
    algorithms: ['HS256'],
    audience: process.env.ADMIN_AUD || 'messagedrop-admin',
    issuer: process.env.ADMIN_ISS || 'https://admin-auth.messagedrop.app/'
  });
}

/**
 * Pflicht-Auth für Admin-Routen.
 * - Nutzt ausschließlich Authorization: Bearer <token>
 * - Verifiziert gegen ADMIN_* (iss/aud/secret)
 * - Schreibt req.admin (payload) oder sendet 401
 */
function requireAdminJwt(req, res, next, { suppressInvalidTokenLog = false } = {}) {
  const token = extractBearerFromHeader(req);
  if (!token) {
    return res.status(401).json({
      errorCode: 'UNAUTHORIZED',
      message: 'missing_admin_token',
      error: 'missing_admin_token'
    });
  }

  try {
    const payload = verifyAdminJwt(token);
    req.admin = payload; // { sub, roles: [...] }
    next();
  } catch (error) {
    if (!suppressInvalidTokenLog) {
      req.logger?.warn('Invalid admin token', { error: error?.message });
    }
    return res.status(401).json({
      errorCode: 'UNAUTHORIZED',
      message: 'invalid_admin_token',
      error: 'invalid_admin_token'
    });
  }
}

/**
 * Erlaubt entweder Service-JWT (interne Services) ODER Admin-JWT.
 * - Prüft zuerst Service-JWT (header-only)
 * - Fällt dann auf Admin-JWT (header-only) zurück
 */
function requireServiceOrAdminJwt(req, res, next) {
  const token = extractBearerFromHeader(req);
  if (!token) {
    return res.status(401).json({
      errorCode: 'UNAUTHORIZED',
      message: 'missing_token',
      error: 'missing_token'
    });
  }

  try {
    req.service = verifyServiceJwt(token);
    return next();
  } catch {
    return requireAdminJwt(req, res, next, { suppressInvalidTokenLog: true });
  }
}

/**
 * RBAC-Guard: erlaubt nur bestimmte Rollen.
 * Standard: moderator|legal|admin|root
 */
function requireRole(...allowed) {
  const allowedSet = allowed.length ? allowed : ['moderator', 'legal', 'admin', 'root'];
  return (req, res, next) => {
    const roles = Array.isArray(req.admin?.roles) ? req.admin.roles : [];
    const ok = roles.some((r) => allowedSet.includes(r));
    if (!ok) {
      return res.status(403).json({
        errorCode: 'FORBIDDEN',
        message: 'insufficient_role',
        error: 'insufficient_role'
      });
    }
    next();
  };
}

const checkToken = requireServiceJwt;

module.exports = {
  extractBearerFromHeader,
  authenticateOptionalUser,
  requireAdminJwt,
  requireServiceOrAdminJwt,
  requireRole,
  checkToken
};
