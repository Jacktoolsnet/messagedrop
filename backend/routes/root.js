const path = require('path');

module.exports = function(app) {
    app.get('/', function(req, res) {
      res.send("Service is up and running. " + path.dirname(__filename));
    });
  };