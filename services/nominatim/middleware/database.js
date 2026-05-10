module.exports = function (database) {
  return function (req, res, next) {
    req.database = database;
    if (
      typeof database?.isOverloaded === 'function'
      && database.isOverloaded()
      && !String(req.path || '').startsWith('/health')
    ) {
      res.set('Retry-After', process.env.NOMINATIM_DB_OVERLOAD_RETRY_AFTER_SECONDS || process.env.DB_OVERLOAD_RETRY_AFTER_SECONDS || '2');
      return res.status(503).json({
        errorCode: 'SERVICE_UNAVAILABLE',
        message: 'database_busy',
        error: 'database_busy',
        pendingCount: typeof database.pendingCount === 'function' ? database.pendingCount() : undefined,
        maxPendingRequests: typeof database.maxPendingRequests === 'function' ? database.maxPendingRequests() : undefined
      });
    }
    next();
  };
};
