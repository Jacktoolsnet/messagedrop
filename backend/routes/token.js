const security = require('../middleware/security');

module.exports = function(app) {
    app.get('/token', [security.checkToken], function(req, res) {
      res.sendStatus(200);
    });
  };