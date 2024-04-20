const security = require('../middleware/security')

module.exports = function(app) {
    app.get('/', function(req, res) {
      res.send("Hello World");
    });
  };