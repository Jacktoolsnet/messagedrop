const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const security = require('../middleware/security');
const tableConnect = require('../db/tableConnect');
const metric = require('../middleware/metric');
const { apiError } = require('../middleware/api-error');

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

function fetchConnectRecord(req, res, connectId, handler, next) {
  tableConnect.getById(req.database.db, connectId, (err, row) => {
    if (err) {
      return next(apiError.internal('db_error'));
    }
    if (!row) {
      return next(apiError.notFound('not_found'));
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
  , function (req, res, next) {
    let response = { 'status': 0 };
    if (!ensureSameUser(req, res, req.body.userId)) {
      return;
    }
    let connectId = crypto.randomUUID();
    tableConnect.create(req.database.db, connectId, req.body.userId, req.body.hint, req.body.encryptionPublicKey, req.body.signingPublicKey, req.body.signature, function (err) {
      if (err) {
        return next(apiError.internal('db_error'));
      }
      response.status = 200;
      response.connectId = connectId;
      res.status(200).json(response);
    });
  });

router.get('/get/:connectId',
  [
    security.authenticate
  ]
  , function (req, res, next) {
    let response = { 'status': 0 };
    fetchConnectRecord(req, res, req.params.connectId, (row) => {
      response.status = 200;
      response.connect = row;
      res.status(response.status).json(response);
    }, next);
  });

router.get('/delete/:connectId',
  [
    security.authenticate
  ]
  , function (req, res, next) {
    let response = { 'status': 0 };
    fetchConnectRecord(req, res, req.params.connectId, () => {
      tableConnect.deleteById(req.database.db, req.params.connectId, function (err) {
        if (err) {
          return next(apiError.internal('db_error'));
        }
        response.status = 200;
        res.status(200).json(response);
      });
    }, next);
  });

module.exports = router
