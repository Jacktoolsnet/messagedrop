const express = require('express');
const router = express.Router();

function isDatabaseConnected(database) {
  const db = database?.db;
  if (!db) return false;
  try {
    if (typeof db.prepare === 'function') {
      const stmt = db.prepare('SELECT 1 AS ok');
      return Boolean(stmt?.get?.());
    }
    if (typeof db.get === 'function') {
      return Boolean(db.get('SELECT 1 AS ok'));
    }
  } catch {
    return false;
  }
  return false;
}

router.get('/', function (req, res) {
  const isDbOpen = isDatabaseConnected(req.database);
  const databaseConnection = isDbOpen ? 'established' : 'not established';
  const response = {
    status: 'Service is up and running.',
    database_connection: databaseConnection
  };
  res.status(200).json(response);
});

module.exports = router
