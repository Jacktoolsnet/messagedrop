// middleware/security.js
const { requireServiceJwt } = require('../utils/serviceJwt');

module.exports = {
  checkToken: requireServiceJwt
};
