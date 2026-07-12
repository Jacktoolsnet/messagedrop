module.exports = (database) => (req, res, next) => {
  req.database = database;
  if (!database.db) return res.status(503).json({ errorCode: 'SERVICE_UNAVAILABLE', message: 'database_unavailable', error: 'database_unavailable' });
  if (database.isOverloaded()) {
    res.set('Retry-After', process.env.WIKIPEDIA_DB_OVERLOAD_RETRY_AFTER_SECONDS || '2');
    return res.status(503).json({ errorCode: 'SERVICE_UNAVAILABLE', message: 'database_busy', error: 'database_busy' });
  }
  next();
};
