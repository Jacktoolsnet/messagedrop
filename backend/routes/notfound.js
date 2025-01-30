const express = require('express');
const router = express.Router();

router.get('{*notFound}', function (req, res) {
  res.sendStatus(404);
});

module.exports = router