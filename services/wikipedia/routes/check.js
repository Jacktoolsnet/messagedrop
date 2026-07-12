const express = require('express');
const { requireServiceJwt } = require('../utils/serviceJwt');
const router = express.Router();
router.post('/', requireServiceJwt, (req, res) => res.json({ token: 'ok', database_connection: req.database?.db ? 'established' : 'not established', reqBody: req.body }));
module.exports = router;
