const security = require('../middleware/security');
const bodyParser = require('body-parser');

module.exports = function(app) {
    app.post('/check', [security.checkToken, bodyParser.json({ type: 'application/json' })], function(req, res) {
      res.setHeader('Content-Type', 'application/json');
      res.status(200);
      let database_open
      if (undefined === req.database) {
        database_connection = 'not established'
      } else {
        if (req.database.db.open) {
          database_connection = 'established'
        } else {
          database_connection = 'not established'
        } 
      }
      let response = {
        'token' : 'ok',
        database_connection,
        'reqBody' : req.body
       };
      res.send(JSON.stringify(response, null, 2))
    });
  };