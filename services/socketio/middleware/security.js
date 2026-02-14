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
  const token = extractBearerFromHeader(req);
  if (!token) {
    return res.status(401).json({
      errorCode: 'UNAUTHORIZED',
      message: 'missing_token',
      error: 'missing_token'
    });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({
      errorCode: 'SERVER_ERROR',
      message: 'auth_not_configured',
      error: 'auth_not_configured'
    });
  }

  jwt.verify(token, secret, { algorithms: ['HS256'] }, (err, jwtUser) => {
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

const checkToken = requireServiceJwt;

module.exports = {
  authenticate,
  checkToken
}
