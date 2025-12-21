require('dotenv').config();

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

function checkToken(req, res, next) {
  const authHeader = req.headers['x-api-authorization'];
  const token = authHeader
  if (undefined === process.env.TOKEN || process.env.TOKEN === '' || (token !== process.env.TOKEN && token !== process.env.BACKEND_TOKEN)) {
    res.sendStatus(403);
  } else {
    next();
  }
};

module.exports = {
  authenticate,
  checkToken
}
