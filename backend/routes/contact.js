const express = require('express');
const { getEncryptionPublicKey } = require('../utils/keyStore');
const cryptoUtil = require('../utils/cryptoUtils');
const router = express.Router();
const uuid = require('uuid');
const security = require('../middleware/security');
const bodyParser = require('body-parser');
const tableContact = require('../db/tableContact');
const notify = require('../utils/notify');
const metric = require('../middleware/metric');

router.post('/create',
  [
    security.checkToken,
    security.authenticate, bodyParser.json({ type: 'application/json' }),
    metric.count('contact.create', { when: 'always', timezone: 'utc', amount: 1 })
  ]
  , function (req, res) {
    let response = { 'status': 0 };
    let contactId = uuid.v4()
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


router.post('/update/name', [security.checkToken, security.authenticate, bodyParser.json({ type: 'application/json' })], async function (req, res) {
  let response = { 'status': 0 };
  let cryptedName = await cryptoUtil.encrypt(await getEncryptionPublicKey(), req.body.name.replace(/\'/g, "''"));
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

/**
 * Update my message in my contact.
 * Find the other contact (userID = contactUserId and contactUserID = userID) and set the contact message
 * Notify other User
 */
router.post('/update/message',
  [
    security.checkToken,
    security.authenticate,
    bodyParser.json({ type: 'application/json' }),
    metric.count('contact.update.message', { when: 'always', timezone: 'utc', amount: 1 })
  ]
  , function (req, res) {
    let response = { 'status': 0 };
    tableContact.updateUserMessage(req.database.db, req.body.contactId, req.body.userEncryptedMessage, req.body.messageSignature, function (err) {
      if (err) {
        response.status = 500;
        response.error = err;
        res.status(response.status);
        res.json(response);
      } else {
        tableContact.updateContactUserMessage(req.database.db, req.body.userId, req.body.contactUserId, req.body.contactUserEncryptedMessage, req.body.messageSignature, function (err) {
          if (err) {
            response.status = 500;
            response.error = err;
          } else {
            response.status = 200;
            notify.contactSubscriptions(req.logger, req.database.db, req.body.userId, req.body.contactUserId, "New private message");
          }
          res.status(response.status).json(response);
        });
      }
    });
  });

router.get('/get/:contactId', [security.checkToken, security.authenticate], function (req, res) {
  let response = { 'status': 0 };
  tableContact.getById(req.database.db, req.params.contactId, function (err, row) {
    if (err) {
      response.status = 500;
      response.error = err;
    } else {
      if (!row) {
        response.status = 404;
      } else {
        response.status = 200;
        response.place = row;
      }
    }
    res.status(response.status).json(response);
  });
});

router.get('/get/userId/:userId', [security.checkToken, security.authenticate], function (req, res) {
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

router.get('/subscribe/:contactId', [security.checkToken, security.authenticate, bodyParser.json({ type: 'application/json' })], function (req, res) {
  let response = { 'status': 0 };
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

router.get('/unsubscribe/:contactId', [security.checkToken, security.authenticate], function (req, res) {
  let response = { 'status': 0 };
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

router.get('/delete/:contactId', [security.checkToken, security.authenticate], function (req, res) {
  let response = { 'status': 0 };
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

module.exports = router