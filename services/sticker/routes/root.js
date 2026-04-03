const express = require('express');
const router = express.Router();

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

router.get('/', async function (req, res) {
  const isDbOpen = await isDatabaseConnected(req.database);
  const databaseConnection = isDbOpen ? 'established' : 'not established';
  const response = {
    status: 'Service is up and running.',
    database_connection: databaseConnection
  };
  res.status(200).json(response);
});

module.exports = router
