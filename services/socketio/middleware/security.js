require('dotenv').config();
const { requireServiceJwt } = require('../utils/serviceJwt');

function authenticate(req, res, next) {
  let jwt;
  try {
    jwt = require('jsonwebtoken');
  } catch {
    return res.status(403).json({
      errorCode: 'UNAUTHORIZED',
      message: 'invalid_token',
      error: 'invalid_token'
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

const checkToken = requireServiceJwt;

module.exports = {
  authenticate,
  checkToken
}
