const express = require('express');
const router = express.Router();
const security = require('../middleware/security');

router.post('/',
  [
    security.checkToken,
    express.json({ type: 'application/json' })
  ]
  , function (req, res) {
    const isDbOpen = req.database?.db?.open === true;
    const databaseConnection = isDbOpen ? 'established' : 'not established';
    const response = {
      token: 'ok',
      database_connection: databaseConnection,
      reqBody: req.body
    };
    res.status(200).json(response);
  });

module.exports = router
