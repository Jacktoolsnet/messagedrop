const security = require('../middleware/security');
const bodyParser = require('body-parser');

module.exports = function(app) {
    app.post('/echo', [security.checkToken, bodyParser.json], function(req, res) {
      res.setHeader('Content-Type', 'application/json');
      res.status(200);
      res.send(JSON.stringify(req.body, null, 2));
    });
  };