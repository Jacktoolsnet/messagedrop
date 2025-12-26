const express = require('express');
const { getEncryptionPublicKey } = require('../utils/keyStore');
const cryptoUtil = require('../utils/cryptoUtils');
const router = express.Router();
const crypto = require('crypto');
const security = require('../middleware/security');
const tableContact = require('../db/tableContact');
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

function withContactOwnership(req, res, contactId, handler) {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return res.status(401).json({ status: 401, error: 'unauthorized' });
  }
  tableContact.getById(req.database.db, contactId, (err, row) => {
    if (err) {
      return res.status(500).json({ status: 500, error: err });
    }
    if (!row) {
      return res.status(404).json({ status: 404, error: 'not_found' });
    }
    if (String(row.userId) !== String(authUserId)) {
      return res.status(403).json({ status: 403, error: 'forbidden' });
    }
    try {
      Promise.resolve(handler(row)).catch((handlerErr) => {
        res.status(500).json({ status: 500, error: handlerErr?.message || handlerErr });
      });
    } catch (handlerErr) {
      res.status(500).json({ status: 500, error: handlerErr?.message || handlerErr });
    }
  });
}

router.post('/create',
  [
    security.authenticate,
    express.json({ type: 'application/json' }),
    metric.count('contact.create', { when: 'always', timezone: 'utc', amount: 1 })
  ]
  , function (req, res) {
    let response = { 'status': 0 };
    if (!ensureSameUser(req, res, req.body.userId)) {
      return;
    }
    let contactId = crypto.randomUUID();
    tableContact.create(req.database.db, contactId, req.body.userId, req.body.contactUserId, req.body.hint, req.body.contactUserSigningPublicKey, req.body.contactUserEncryptionPublicKey, function (err) {
      if (err) {
        response.status = 500;
        response.error = err;
      } else {
        response.status = 200;
        response.contactId = contactId;
      }
      res.status(response.status).json(response);
    });
  });


router.post('/update/name',
  [
    security.authenticate,
    express.json({ type: 'application/json' })
  ]
  , async function (req, res) {
    let response = { 'status': 0 };
    withContactOwnership(req, res, req.body.contactId, async () => {
      const sanitizedName = (req.body.name || '').replace(/'/g, "''");
      const cryptedName = await cryptoUtil.encrypt(await getEncryptionPublicKey(), sanitizedName);
      tableContact.updateName(req.database.db, req.body.contactId, JSON.stringify(cryptedName), function (err) {
        if (err) {
          response.status = 500;
          response.error = err;
          res.status(response.status).json(response);
        } else {
          response.status = 200;
          res.status(response.status).json(response);
        }
      });
    });
  });

router.get('/get/:contactId',
  [
    security.authenticate
  ]
  , function (req, res) {
    let response = { 'status': 0 };
    withContactOwnership(req, res, req.params.contactId, (row) => {
      response.status = 200;
      response.place = row;
      res.status(response.status).json(response);
    });
  });

router.get('/get/userId/:userId',
  [
    security.authenticate
  ]
  , function (req, res) {
    if (!ensureSameUser(req, res, req.params.userId)) {
      return;
    }
    let response = { 'status': 0, 'rows': [] };
    tableContact.getByUserId(req.database.db, req.params.userId, function (err, rows) {
      if (err) {
        response.status = 500;
        response.error = err;
      } else {
        response.status = 200;
        if (!rows || rows.length == 0) {
          response.status = 404;
        } else {
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
        }
      }
      res.status(response.status).json(response);
    });
  });

router.get('/subscribe/:contactId',
  [
    security.authenticate,
    express.json({ type: 'application/json' })
  ]
  , function (req, res) {
    let response = { 'status': 0 };
    withContactOwnership(req, res, req.params.contactId, () => {
      tableContact.subscribe(req.database.db, req.params.contactId, function (err) {
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

router.get('/unsubscribe/:contactId',
  [
    security.authenticate
  ]
  , function (req, res) {
    let response = { 'status': 0 };
    withContactOwnership(req, res, req.params.contactId, () => {
      tableContact.unsubscribe(req.database.db, req.params.contactId, function (err) {
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

router.get('/delete/:contactId',
  [
    security.authenticate
  ]
  , function (req, res) {
    let response = { 'status': 0 };
    withContactOwnership(req, res, req.params.contactId, () => {
      tableContact.deleteById(req.database.db, req.params.contactId, function (err) {
        if (err) {
          response.status = 500;
          response.error = err;
        } else {
          response.status = 200;
        }
        res.setHeader('Content-Type', 'application/json');
        res.status(response.status).json(response);
      });
    });
  });

module.exports = router
