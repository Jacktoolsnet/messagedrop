const express = require('express');
const router = express.Router();
router.get('/', (_req, res) => res.json({ status: 'Geodata service is up and running.' }));
module.exports = router;
