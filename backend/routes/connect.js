const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const security = require('../middleware/security');
const tableConnect = require('../db/tableConnect');
const metric = require('../middleware/metric');
const { apiError } = require('../middleware/api-error');
const CONNECT_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getAuthUserId(req) {
  return req.jwtUser?.userId ?? req.jwtUser?.id ?? null;
}

function ensureSameUser(req, res, userId, next) {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    if (next) {
      next(apiError.unauthorized('unauthorized'));
    } else {
      res.status(401).json({ status: 401, error: 'unauthorized' });
    }
    return false;
  }
  if (String(authUserId) !== String(userId)) {
    if (next) {
      next(apiError.forbidden('forbidden'));
    } else {
      res.status(403).json({ status: 403, error: 'forbidden' });
    }
    return false;
  }
  return true;
}

function normalizeConnectId(connectId) {
  const normalizedConnectId = String(connectId ?? '').trim();
  if (!CONNECT_ID_REGEX.test(normalizedConnectId)) {
    return null;
  }
  return normalizedConnectId;
}

function queryGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row || null);
    });
  });
}

function runQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this);
    });
  });
}

async function consumeConnectRecord(db, connectId) {
  await runQuery(db, 'BEGIN IMMEDIATE');
  try {
    const row = await queryGet(db, 'SELECT * FROM tableConnect WHERE id = ?;', [connectId]);
    if (!row) {
      await runQuery(db, 'ROLLBACK');
      return null;
    }
    await runQuery(db, 'DELETE FROM tableConnect WHERE id = ?;', [connectId]);
    await runQuery(db, 'COMMIT');
    return row;
  } catch (err) {
    try {
      await runQuery(db, 'ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    throw err;
  }
}

function fetchConnectRecord(req, res, connectId, handler, next) {
  const normalizedConnectId = normalizeConnectId(connectId);
  if (!normalizedConnectId) {
    return next(apiError.badRequest('invalid_connect_id'));
  }
  tableConnect.getById(req.database.db, normalizedConnectId, (err, row) => {
    if (err) {
      return next(apiError.internal('db_error'));
    }
    if (!row) {
      return next(apiError.notFound('not_found'));
    }
    handler(row, normalizedConnectId);
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
    if (!ensureSameUser(req, res, req.body.userId, next)) {
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
      if (!ensureSameUser(req, res, row.userId, next)) {
        return;
      }
      response.status = 200;
      response.connect = row;
      res.status(response.status).json(response);
    }, next);
  });

router.get('/consume/:connectId',
  [
    security.authenticate,
    metric.count('connect.consume', { when: 'always', timezone: 'utc', amount: 1 })
  ],
  async function (req, res, next) {
    const normalizedConnectId = normalizeConnectId(req.params.connectId);
    if (!normalizedConnectId) {
      return next(apiError.badRequest('invalid_connect_id'));
    }
    try {
      const row = await consumeConnectRecord(req.database.db, normalizedConnectId);
      if (!row) {
        return next(apiError.notFound('not_found'));
      }
      return res.status(200).json({ status: 200, connect: row });
    } catch {
      return next(apiError.internal('db_error'));
    }
  });

router.get('/delete/:connectId',
  [
    security.authenticate
  ]
  , function (req, res, next) {
    let response = { 'status': 0 };
    fetchConnectRecord(req, res, req.params.connectId, (row, normalizedConnectId) => {
      if (!ensureSameUser(req, res, row.userId, next)) {
        return;
      }
      tableConnect.deleteById(req.database.db, normalizedConnectId, function (err) {
        if (err) {
          return next(apiError.internal('db_error'));
        }
        response.status = 200;
        res.status(200).json(response);
      });
    }, next);
  });

module.exports = router
