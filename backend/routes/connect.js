const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');
const security = require('../middleware/security');
const tableConnect = require('../db/tableConnect');
const { signServiceJwt } = require('../utils/serviceJwt');
const { resolveBaseUrl } = require('../utils/adminLogForwarder');
const metric = require('../middleware/metric');
const { apiError } = require('../middleware/api-error');
const SOCKET_AUDIENCE = process.env.SERVICE_JWT_AUDIENCE_SOCKET || 'service.socketio';

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

function resolveSocketIoBaseUrl() {
  return resolveBaseUrl(process.env.SOCKETIO_BASE_URL || process.env.BASE_URL, process.env.SOCKETIO_PORT);
}

async function emitContactsUpdated(userId) {
  const baseUrl = resolveSocketIoBaseUrl();
  if (!baseUrl || !userId) {
    return;
  }

  try {
    const token = await signServiceJwt({ audience: SOCKET_AUDIENCE });
    await axios.post(`${baseUrl}/emit/user`, {
      userId,
      event: String(userId),
      payload: {
        status: 200,
        type: 'contacts_updated',
        content: { userId }
      }
    }, {
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      timeout: 3000,
      validateStatus: () => true
    });
  } catch {
    // best-effort only
  }
}

function validateConnectPayload(body) {
  const required = ['userId', 'hint', 'signature', 'encryptionPublicKey', 'signingPublicKey'];
  const missing = required.filter((key) => body?.[key] === undefined || body?.[key] === null || body?.[key] === '');
  return missing.length ? `missing_${missing.join('_')}` : null;
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

async function getOrCreateContact(db, { userId, contactUserId, hint, signingPublicKey, encryptionPublicKey }) {
  const existing = await queryGet(
    db,
    'SELECT * FROM tableContact WHERE userId = ? AND contactUserId = ?;',
    [userId, contactUserId]
  );
  if (existing?.id) {
    return { id: existing.id, created: false };
  }

  const contactId = crypto.randomUUID();
  await runQuery(
    db,
    `INSERT INTO tableContact (
      id,
      userId,
      contactUserId,
      contactUserSigningPublicKey,
      contactUserEncryptionPublicKey,
      hint
    ) VALUES (?, ?, ?, ?, ?, ?);`,
    [contactId, userId, contactUserId, signingPublicKey, encryptionPublicKey, hint ?? null]
  );
  return { id: contactId, created: true };
}

async function consumeConnectAndCreateContacts(db, connectId, requester) {
  await runQuery(db, 'BEGIN IMMEDIATE');
  try {
    const row = await queryGet(db, 'SELECT * FROM tableConnect WHERE id = ?;', [connectId]);
    if (!row) {
      await runQuery(db, 'ROLLBACK');
      return null;
    }

    if (String(row.userId) === String(requester.userId)) {
      await runQuery(db, 'ROLLBACK');
      return { self: true };
    }

    await runQuery(db, 'DELETE FROM tableConnect WHERE id = ?;', [connectId]);

    const requesterContact = await getOrCreateContact(db, {
      userId: requester.userId,
      contactUserId: row.userId,
      hint: row.hint,
      signingPublicKey: row.signingPublicKey,
      encryptionPublicKey: row.encryptionPublicKey
    });

    const ownerContact = await getOrCreateContact(db, {
      userId: row.userId,
      contactUserId: requester.userId,
      hint: requester.hint,
      signingPublicKey: requester.signingPublicKey,
      encryptionPublicKey: requester.encryptionPublicKey
    });

    await runQuery(db, 'COMMIT');
    return { connect: row, contactId: requesterContact.id, reciprocalContactId: ownerContact.id };
  } catch (err) {
    try {
      await runQuery(db, 'ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    throw err;
  }
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


router.post('/consume/:connectId',
  [
    security.authenticate,
    express.json({ type: 'application/json' }),
    metric.count('connect.consume', { when: 'always', timezone: 'utc', amount: 1 })
  ],
  async function (req, res, next) {
    const normalizedConnectId = normalizeConnectId(req.params.connectId);
    if (!normalizedConnectId) {
      return next(apiError.badRequest('invalid_connect_id'));
    }

    const validationError = validateConnectPayload(req.body);
    if (validationError) {
      return next(apiError.badRequest(validationError));
    }

    if (!ensureSameUser(req, res, req.body.userId, next)) {
      return;
    }

    try {
      const result = await consumeConnectAndCreateContacts(req.database.db, normalizedConnectId, req.body);
      if (!result) {
        return next(apiError.notFound('not_found'));
      }
      if (result.self) {
        return next(apiError.badRequest('self_add_blocked'));
      }

      void emitContactsUpdated(result.connect.userId);

      return res.status(200).json({
        status: 200,
        connect: result.connect,
        contactId: result.contactId,
        reciprocalContactId: result.reciprocalContactId
      });
    } catch {
      return next(apiError.internal('db_error'));
    }
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
