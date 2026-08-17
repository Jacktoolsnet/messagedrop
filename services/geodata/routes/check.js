const express = require('express');
const { requireServiceJwt } = require('../utils/serviceJwt');
const router = express.Router();
router.post('/', requireServiceJwt, (_req, res) => res.json({ token: 'ok' }));
module.exports = router;
