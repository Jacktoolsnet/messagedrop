const express = require('express');
const router = express.Router();

router.get('/', function (req, res) {
  const isDbOpen = req.database?.db?.open === true;
  const databaseConnection = isDbOpen ? 'established' : 'not established';
  const response = {
    status: 'Service is up and running.',
    database_connection: databaseConnection
  };
  res.status(200).json(response);
});

module.exports = router
