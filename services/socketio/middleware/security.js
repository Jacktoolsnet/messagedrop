require('dotenv').config();
const { requireServiceJwt } = require('../utils/serviceJwt');

function authenticate(req, res, next) {
  let jwt;
  try {
    jwt = require('jsonwebtoken');
  } catch {
    return res.sendStatus(403);
  }

  const secret = process.env.JWT_SECRET;
  jwt.verify(req.token, secret, (err, jwtUser) => {
    if (err) return res.sendStatus(403);
    req.jwtUser = jwtUser;
    next();
  });
}

const checkToken = requireServiceJwt;

module.exports = {
  authenticate,
  checkToken
}
