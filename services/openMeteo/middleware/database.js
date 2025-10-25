module.exports = function (database) {
  return function (req, res, next) {
    req.database = database;
    next();
  }
}