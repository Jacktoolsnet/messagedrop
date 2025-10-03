// middleware/security.js
require('dotenv').config();
const jwt = require('jsonwebtoken');

/**
 * Optionales User-JWT für Public-Routen.
 * - Nutzt req.token (kommt von express-bearer-token)
 * - Verifiziert gegen PUBLIC_* (iss/aud/secret), wenn vorhanden
 * - Bei Fehlern oder ohne Token: req.jwtUser bleibt undefined
 */
function authenticateOptionalUser(req, _res, next) {
  const token = req.token;
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

/**
 * Pflicht-Auth für Admin-Routen.
 * - Nutzt req.token (express-bearer-token, Header/Query/Body kompatibel)
 * - Verifiziert gegen ADMIN_* (iss/aud/secret)
 * - Schreibt req.admin (payload) oder sendet 401
 */
function requireAdminJwt(req, res, next) {
  const token = req.token;
  if (!token) return res.status(401).json({ error: 'missing_admin_token' });

  try {
    const payload = jwt.verify(token, process.env.ADMIN_JWT_SECRET, {
      algorithms: ['HS256'],
      audience: process.env.ADMIN_AUD || 'messagedrop-admin',
      issuer: process.env.ADMIN_ISS || 'https://admin-auth.messagedrop.app/'
    });
    req.admin = payload; // { sub, roles: [...] }
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid_admin_token' });
  }
}

/**
 * RBAC-Guard: erlaubt nur bestimmte Rollen.
 * Standard: moderator|legal|admin
 */
function requireRole(...allowed) {
  const allowedSet = allowed.length ? allowed : ['moderator', 'legal', 'admin'];
  return (req, res, next) => {
    const roles = Array.isArray(req.admin?.roles) ? req.admin.roles : [];
    const ok = roles.some(r => allowedSet.includes(r));
    if (!ok) return res.status(403).json({ error: 'insufficient_role' });
    next();
  };
}

/**
 * Statisches Token (für interne Service-to-Service Calls)
 * → nutzt x-api-authorization Header
 */
function checkToken(req, res, next) {
  const headerToken = req.headers['x-api-authorization'];
  if (!process.env.ADMIN_TOKEN || headerToken !== process.env.ADMIN_TOKEN) {
    return res.sendStatus(403);
  }
  next();
}

module.exports = {
  authenticateOptionalUser,
  requireAdminJwt,
  requireRole,
  checkToken
};