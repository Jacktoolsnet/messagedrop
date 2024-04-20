var checkToken = function (req, res, next) {
    if (req.token !== process.env.TOKEN) {
      res.sendStatus(403);
    } else {
      next();
    }
  };

module.exports = {
    checkToken
}