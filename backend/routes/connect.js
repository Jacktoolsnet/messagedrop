const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const security = require('../middleware/security');
const tableConnect = require('../db/tableConnect');
const metric = require('../middleware/metric');

function getAuthUserId(req) {
  return req.jwtUser?.userId ?? req.jwtUser?.id ?? null;
}

function ensureSameUser(req, res, userId) {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    res.status(401).json({ status: 401, error: 'unauthorized' });
    return false;
  }
  if (String(authUserId) !== String(userId)) {
    res.status(403).json({ status: 403, error: 'forbidden' });
    return false;
  }
  return true;
}

function withConnectOwnership(req, res, connectId, handler) {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return res.status(401).json({ status: 401, error: 'unauthorized' });
  }
  tableConnect.getById(req.database.db, connectId, (err, row) => {
    if (err) {
      return res.status(500).json({ status: 500, error: err });
    }
    if (!row) {
      return res.status(404).json({ status: 404, error: 'not_found' });
    }
    if (String(row.userId) !== String(authUserId)) {
      return res.status(403).json({ status: 403, error: 'forbidden' });
    }
    handler(row);
  });
}

router.post('/create',
  [
    security.authenticate,
    express.json({ type: 'application/json' }),
    metric.count('connect.create', { when: 'always', timezone: 'utc', amount: 1 })
  ]
  , function (req, res) {
    let response = { 'status': 0 };
    if (!ensureSameUser(req, res, req.body.userId)) {
      return;
    }
    let connectId = crypto.randomUUID();
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

router.get('/get/:connectId',
  [
    security.authenticate
  ]
  , function (req, res) {
    let response = { 'status': 0 };
    withConnectOwnership(req, res, req.params.connectId, (row) => {
      response.status = 200;
      response.connect = row;
      res.status(response.status).json(response);
    });
  });

router.get('/delete/:connectId',
  [
    security.authenticate
  ]
  , function (req, res) {
    let response = { 'status': 0 };
    withConnectOwnership(req, res, req.params.connectId, () => {
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
  });

module.exports = router
