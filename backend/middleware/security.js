require('dotenv').config();
const jwt = require('jsonwebtoken');
const { requireServiceJwt } = require('../utils/serviceJwt');

function authenticate(req, res, next) {
  if (!req.token) {
    return res.status(403).json({
      errorCode: 'UNAUTHORIZED',
      message: 'missing_token',
      error: 'missing_token'
    });
  }
  const secret = process.env.JWT_SECRET;
  jwt.verify(req.token, secret, (err, jwtUser) => {
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

module.exports = {
  authenticate,
  checkToken: requireServiceJwt
}
