module.exports = function () {
  return function (req, res, next) {
    res.setHeader('Content-Type', 'application/json');
    next();
  }
}