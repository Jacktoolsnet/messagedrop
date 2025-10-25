// middleware/security.js
require('dotenv').config();

/**
 * Statisches Token (für interne Service-to-Service Calls)
 * → nutzt x-api-authorization Header
 */
function checkToken(req, res, next) {
  const authHeader = req.headers['x-api-authorization'];
  const token = authHeader
  if (undefined === process.env.TOKEN || process.env.TOKEN === '' || token !== process.env.BACKEND_TOKEN) {
    res.sendStatus(403);
  } else {
    next();
  }
};

module.exports = {
  checkToken
};