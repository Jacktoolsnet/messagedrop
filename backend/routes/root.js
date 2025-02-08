const express = require('express');
const router = express.Router();

router.get('/', function (req, res) {
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
    'status': 'Service is up and running.',
    database_connection
  };
  res.status(200).json(response);
});

module.exports = router