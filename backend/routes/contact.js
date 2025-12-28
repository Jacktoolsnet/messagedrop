const express = require('express');
const { getEncryptionPublicKey } = require('../utils/keyStore');
const cryptoUtil = require('../utils/cryptoUtils');
const router = express.Router();
const crypto = require('crypto');
const security = require('../middleware/security');
const tableContact = require('../db/tableContact');
const metric = require('../middleware/metric');
const { apiError } = require('../middleware/api-error');

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

function withContactOwnership(req, res, contactId, handler, next) {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return next(apiError.unauthorized('unauthorized'));
  }
  tableContact.getById(req.database.db, contactId, (err, row) => {
    if (err) {
      return next(apiError.internal('db_error'));
    }
    if (!row) {
      return next(apiError.notFound('not_found'));
    }
    if (String(row.userId) !== String(authUserId)) {
      return next(apiError.forbidden('forbidden'));
    }
    try {
      Promise.resolve(handler(row)).catch(() => {
        next(apiError.internal('handler_failed'));
      });
    } catch (handlerErr) {
      next(apiError.internal('handler_failed'));
    }
  });
}

router.post('/create',
  [
    security.authenticate,
    express.json({ type: 'application/json' }),
    metric.count('contact.create', { when: 'always', timezone: 'utc', amount: 1 })
  ]
  , function (req, res, next) {
    let response = { 'status': 0 };
    if (!ensureSameUser(req, res, req.body.userId, next)) {
      return;
    }
    let contactId = crypto.randomUUID();
    tableContact.create(req.database.db, contactId, req.body.userId, req.body.contactUserId, req.body.hint, req.body.contactUserSigningPublicKey, req.body.contactUserEncryptionPublicKey, function (err) {
      if (err) {
        return next(apiError.internal('db_error'));
      }
      response.status = 200;
      response.contactId = contactId;
      res.status(200).json(response);
    });
  });


router.post('/update/name',
  [
    security.authenticate,
    express.json({ type: 'application/json' })
  ]
  , async function (req, res, next) {
    let response = { 'status': 0 };
    withContactOwnership(req, res, req.body.contactId, async () => {
      const sanitizedName = (req.body.name || '').replace(/'/g, "''");
      const cryptedName = await cryptoUtil.encrypt(await getEncryptionPublicKey(), sanitizedName);
      tableContact.updateName(req.database.db, req.body.contactId, JSON.stringify(cryptedName), function (err) {
        if (err) {
          return next(apiError.internal('db_error'));
        }
        response.status = 200;
        res.status(200).json(response);
      });
    }, next);
  });

router.get('/get/:contactId',
  [
    security.authenticate
  ]
  , function (req, res, next) {
    let response = { 'status': 0 };
    withContactOwnership(req, res, req.params.contactId, (row) => {
      response.status = 200;
      response.place = row;
      res.status(response.status).json(response);
    }, next);
  });

router.get('/get/userId/:userId',
  [
    security.authenticate
  ]
  , function (req, res, next) {
    if (!ensureSameUser(req, res, req.params.userId, next)) {
      return;
    }
    let response = { 'status': 0, 'rows': [] };
    tableContact.getByUserId(req.database.db, req.params.userId, function (err, rows) {
      if (err) {
        return next(apiError.internal('db_error'));
      }
      response.status = 200;
      if (!rows || rows.length == 0) {
        return next(apiError.notFound('not_found'));
      }
      rows.forEach((row) => {
        response.rows.push({
          'id': row.id,
          'userId': row.userId,
          'userEncryptedMessage': row.userEncryptedMessage,
          'userMessageStyle': row.userMessageStyle,
          'userSignature': row.userSignature,
          'contactUserId': row.contactUserId,
          'contactUserSigningPublicKey': row.contactUserSigningPublicKey,
          'contactUserEncryptionPublicKey': row.contactUserEncryptionPublicKey,
          'contactUserEncryptedMessage': row.contactUserEncryptedMessage,
          'contactUserSignature': row.contactUserSignature,
          'subscribed': row.subscribed === 0 ? false : true,
          'hint': row.hint == null ? '' : row.hint,
          'name': row.name == null ? '' : row.name,
          'base64Avatar': row.base64Avatar,
          'lastMessageFrom': row.lastMessageFrom
        });
      });
      res.status(200).json(response);
    });
  });

router.get('/subscribe/:contactId',
  [
    security.authenticate,
    express.json({ type: 'application/json' })
  ]
  , function (req, res, next) {
    let response = { 'status': 0 };
    withContactOwnership(req, res, req.params.contactId, () => {
      tableContact.subscribe(req.database.db, req.params.contactId, function (err) {
        if (err) {
          return next(apiError.internal('db_error'));
        }
        response.status = 200;
        res.status(200).json(response);
      });
    }, next);
  });

router.get('/unsubscribe/:contactId',
  [
    security.authenticate
  ]
  , function (req, res, next) {
    let response = { 'status': 0 };
    withContactOwnership(req, res, req.params.contactId, () => {
      tableContact.unsubscribe(req.database.db, req.params.contactId, function (err) {
        if (err) {
          return next(apiError.internal('db_error'));
        }
        response.status = 200;
        res.status(200).json(response);
      });
    }, next);
  });

router.get('/delete/:contactId',
  [
    security.authenticate
  ]
  , function (req, res, next) {
    let response = { 'status': 0 };
    withContactOwnership(req, res, req.params.contactId, () => {
      tableContact.deleteById(req.database.db, req.params.contactId, function (err) {
        if (err) {
          return next(apiError.internal('db_error'));
        }
        response.status = 200;
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json(response);
      });
    }, next);
  });

module.exports = router
