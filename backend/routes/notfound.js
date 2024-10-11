const express = require('express');
const router = express.Router();

router.get('*', function (req, res) {
  res.sendStatus(404);
});

module.exports = router