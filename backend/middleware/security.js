require('dotenv').config();
const jwt = require('jsonwebtoken');
const { requireServiceJwt } = require('../utils/serviceJwt');

const USER_JWT_ALGORITHM = 'HS256';
const USER_JWT_AUDIENCE = process.env.JWT_AUD || 'messagedrop-frontend';
const USER_JWT_ISSUER = process.env.JWT_ISS || 'https://auth.messagedrop.app/';

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

function getUserJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }
  return secret;
}

function getUserJwtVerifyOptions() {
  return {
    algorithms: [USER_JWT_ALGORITHM],
    audience: USER_JWT_AUDIENCE,
    issuer: USER_JWT_ISSUER
  };
}

function getUserJwtSignOptions(options = {}) {
  return {
    algorithm: USER_JWT_ALGORITHM,
    audience: USER_JWT_AUDIENCE,
    issuer: USER_JWT_ISSUER,
    ...options
  };
}

function verifyUserJwtToken(token) {
  return jwt.verify(token, getUserJwtSecret(), getUserJwtVerifyOptions());
}

function signUserJwt(payload, options = {}) {
  return jwt.sign(payload, getUserJwtSecret(), getUserJwtSignOptions(options));
}

function authenticate(req, res, next) {
  const bearerToken = extractBearerFromHeader(req);
  if (!bearerToken) {
    return res.status(403).json({
      errorCode: 'UNAUTHORIZED',
      message: 'missing_token',
      error: 'missing_token'
    });
  }
  let secret;
  try {
    secret = getUserJwtSecret();
  } catch {
    return res.status(500).json({
      errorCode: 'SERVER_ERROR',
      message: 'auth_not_configured',
      error: 'auth_not_configured'
    });
  }

  jwt.verify(bearerToken, secret, getUserJwtVerifyOptions(), (err, jwtUser) => {
    if (err) {
      return res.status(403).json({
        errorCode: 'UNAUTHORIZED',
        message: 'invalid_token',
        error: 'invalid_token'
      });
    }
    req.jwtUser = jwtUser;
    next();
  });
}

function authenticateOptional(req, _res, next) {
  const bearerToken = extractBearerFromHeader(req);
  if (!bearerToken) {
    return next();
  }
  let secret;
  try {
    secret = getUserJwtSecret();
  } catch {
    return next();
  }
  jwt.verify(bearerToken, secret, getUserJwtVerifyOptions(), (err, jwtUser) => {
    if (!err) {
      req.jwtUser = jwtUser;
    }
    next();
  });
}

module.exports = {
  authenticate,
  authenticateOptional,
  checkToken: requireServiceJwt,
  extractBearerFromHeader,
  getUserJwtSignOptions,
  getUserJwtVerifyOptions,
  signUserJwt,
  verifyUserJwtToken
}
