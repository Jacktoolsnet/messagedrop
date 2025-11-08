const express = require('express');
const router = express.Router();
const security = require('../middleware/security');
const metric = require('../middleware/metric');

router.use(security.checkToken);

router.post('/',
  [
    express.json({ type: 'application/json' }),
    metric.count('check', { when: 'always', timezone: 'utc', amount: 1 })
  ]
  , function (req, res) {
    let database_connection = 'not established';
    if (undefined === req.database) {
      database_connection = 'not established';
    } else {
      if (req.database.db.open) {
        database_connection = 'established';
      } else {
        database_connection = 'not established';
      }
    }
    const response = {
      'token': 'ok',
      database_connection,
      'reqBody': req.body
    };
    res.status(200).json(response);
  });

module.exports = router
