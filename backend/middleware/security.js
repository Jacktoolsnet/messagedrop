require('dotenv').config();
const jwt = require('jsonwebtoken');
const { requireServiceJwt } = require('../utils/serviceJwt');

function authenticate(req, res, next) {
  const secret = process.env.JWT_SECRET;
  jwt.verify(req.token, secret, (err, jwtUser) => {
    if (err) return res.sendStatus(403);
    req.jwtUser = jwtUser;
    next();
  });
}

module.exports = {
  authenticate,
  checkToken: requireServiceJwt
}
