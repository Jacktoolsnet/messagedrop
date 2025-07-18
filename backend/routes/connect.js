const express = require('express');
const router = express.Router();
const uuid = require('uuid');
const security = require('../middleware/security');
const bodyParser = require('body-parser');
const tableConnect = require('../db/tableConnect');

router.post('/create', [security.checkToken, security.authenticate, bodyParser.json({ type: 'application/json' })], function (req, res) {
  let response = { 'status': 0 };
  let connectId = uuid.v4();
  tableConnect.create(req.database.db, connectId, req.body.userId, req.body.hint, req.body.encryptionPublicKey, req.body.signingPublicKey, req.body.signature, function (err) {
    if (err) {
      response.status = 500;
      response.error = err;
    } else {
      response.status = 200;
      response.connectId = connectId;
    }
    res.status(response.status).json(response);
  });
});

router.get('/get/:connectId', [security.checkToken, security.authenticate], function (req, res) {
  let response = { 'status': 0 };
  tableConnect.getById(req.database.db, req.params.connectId, function (err, row) {
    if (err) {
      response.status = 500;
      response.error = err;
    } else {
      if (!row) {
        response.status = 404;
      } else {
        response.status = 200;
        response.connect = row;
      }
    }
    res.status(response.status).json(response);
  });
});

router.get('/delete/:connectId', [security.checkToken, security.authenticate], function (req, res) {
  let response = { 'status': 0 };
  tableConnect.deleteById(req.database.db, req.params.connectId, function (err) {
    if (err) {
      response.status = 500;
      response.error = err;
    } else {
      response.status = 200;
    }
    res.status(response.status).json(response);
  });
});

module.exports = router