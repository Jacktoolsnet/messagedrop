const express = require('express');
const router = express.Router();
const metric = require('../middleware/metric');

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
    express.json({ type: 'application/json' }),
    metric.count('check', { when: 'always', timezone: 'utc', amount: 1 })
  ]
  , async function (req, res) {
    const isDbOpen = await isDatabaseConnected(req.database);
    const database_connection = isDbOpen ? 'established' : 'not established';
    const response = {
      'token': 'ok',
      database_connection,
      'reqBody': req.body
    };
    res.status(200).json(response);
  });

module.exports = router
