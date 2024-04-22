var checkToken = function (req, res, next) {
    if (undefined === process.env.TOKEN || process.env.TOKEN === '' || req.token !== process.env.TOKEN) {
      res.sendStatus(403);
    } else {
      next();
    }
  };

module.exports = {
    checkToken
}