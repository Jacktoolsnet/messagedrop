const security = require('../middleware/security');
const bodyParser = require('body-parser');

module.exports = function(app) {
    app.post('/check', [security.checkToken, bodyParser.json({ type: 'application/json' })], function(req, res) {
      res.setHeader('Content-Type', 'application/json');
      res.status(200);
      let database_open
      if (undefined === req.database) {
        database_open = false
      } else {
        database_open = req.database.db.open
      }
      let response = {
        'token' : 'ok',
        database_open,
        'reqBody' : req.body
       };
      res.send(JSON.stringify(response, null, 2))
    });
  };