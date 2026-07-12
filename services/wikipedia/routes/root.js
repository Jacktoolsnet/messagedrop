const express = require('express');
const router = express.Router();
router.get('/', (req, res) => res.json({ status: 'Service is up and running.', database_connection: req.database?.db ? 'established' : 'not established' }));
module.exports = router;
