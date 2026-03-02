const express = require('express');
const router = express.Router();
const security = require('../middleware/security');

function isDatabaseConnected(database) {
  const db = database?.db;
  if (!db || typeof db.get !== 'function') {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    db.get('SELECT 1 AS ok', (err, row) => {
      if (err) {
        resolve(false);
        return;
      }
      resolve(Boolean(row?.ok ?? row));
    });
  });
}

router.post('/',
  [
    security.checkToken,
    express.json({ type: 'application/json' })
  ]
  , async function (req, res) {
    const isDbOpen = await isDatabaseConnected(req.database);
    const databaseConnection = isDbOpen ? 'established' : 'not established';
    const response = {
      token: 'ok',
      database_connection: databaseConnection,
      reqBody: req.body
    };
    res.status(200).json(response);
  });

module.exports = router
