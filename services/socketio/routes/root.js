const express = require('express');
const router = express.Router();

router.get('/', function (req, res) {
  const response = {
    status: 'Service is up and running.'
  };
  res.status(200).json(response);
});

module.exports = router
