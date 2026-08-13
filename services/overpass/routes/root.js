const express = require('express');
const router = express.Router();
router.get('/', (_req, res) => res.json({ status: 'Overpass service is up and running.' }));
module.exports = router;
