const express = require('express');
const router = express.Router();

function isDatabaseConnected(database) {
  const db = database?.db;
  if (!db || typeof db.get !== 'function') return Promise.resolve(false);
  return new Promise((resolve) => {
    db.get('SELECT 1 AS ok', (error, row) => {
      resolve(!error && Boolean(row?.ok ?? row));
    });
  });
}

router.get('/', async (req, res) => {
  const databaseConnection = await isDatabaseConnected(req.database)
    ? 'established'
    : 'not established';
  res.json({
    status: 'TripGo service is up and running.',
    database_connection: databaseConnection
  });
});

module.exports = router;
module.exports.isDatabaseConnected = isDatabaseConnected;
