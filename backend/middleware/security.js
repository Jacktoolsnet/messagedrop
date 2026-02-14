require('dotenv').config();
const jwt = require('jsonwebtoken');
const { requireServiceJwt } = require('../utils/serviceJwt');

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

function authenticate(req, res, next) {
  const bearerToken = extractBearerFromHeader(req);
  if (!bearerToken) {
    return res.status(403).json({
      errorCode: 'UNAUTHORIZED',
      message: 'missing_token',
      error: 'missing_token'
    });
  }
  const secret = process.env.JWT_SECRET;
  jwt.verify(bearerToken, secret, (err, jwtUser) => {
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
  const secret = process.env.JWT_SECRET;
  jwt.verify(bearerToken, secret, (err, jwtUser) => {
    if (!err) {
      req.jwtUser = jwtUser;
    }
    next();
  });
}

module.exports = {
  authenticate,
  authenticateOptional,
  checkToken: requireServiceJwt
}
