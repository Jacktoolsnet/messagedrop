const express = require('express');
const router = express.Router();
const security = require('../middleware/security');

router.post('/',
  [
    security.checkToken,
    express.json({ type: 'application/json' })
  ]
  , function (req, res) {
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
      'token': 'ok',
      database_connection,
      'reqBody': req.body
    };
    res.status(200).json(response);
  });

module.exports = router