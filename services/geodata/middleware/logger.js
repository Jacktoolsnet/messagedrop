module.exports = function (logger) {
  return function (req, res, next) {
    req.logger = logger;
    next();
  }
}