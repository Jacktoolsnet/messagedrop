const express = require('express');
const router = express.Router();

router.get('/', function(req, res) {
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
    'status' : 'Service is up and running.',
    database_connection
  };
  res.json(response);
});

module.exports = router