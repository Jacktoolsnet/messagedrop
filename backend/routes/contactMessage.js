const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const tableContact = require('../db/tableContact');

const security = require('../middleware/security');
const metric = require('../middleware/metric');
const tableContactMessage = require('../db/tableContactMessage');

router.use(security.checkToken);

const validateSendBody = (body) => {
  const required = ['contactId', 'direction', 'encryptedMessageForUser', 'encryptedMessageForContact', 'signature', 'userId', 'contactUserId'];
  const missing = required.filter((key) => body?.[key] === undefined || body?.[key] === null || body?.[key] === '');
  if (missing.length) {
    return `Missing fields: ${missing.join(', ')}`;
  }
  if (!['user', 'contactUser'].includes(body.direction)) {
    return 'direction must be "user" or "contactUser"';
  }
  return null;
};

// Create/send a message (server-side persist; sockets informieren separat)
router.post('/send',
  [
    security.authenticate,
    express.json({ type: 'application/json' }),
    metric.count('contactMessage.send', { when: 'always', timezone: 'utc', amount: 1 })
  ],
  (req, res) => {
    const validationError = validateSendBody(req.body);
    if (validationError) {
      return res.status(400).json({ status: 400, error: validationError });
    }

    const {
      contactId,
      direction,
      encryptedMessageForUser,
      encryptedMessageForContact,
      signature,
      status = 'sent',
      createdAt,
      id,
      userId,
      contactUserId,
      messageId: providedMessageId
    } = req.body;

    const recordId = id || crypto.randomUUID();
    const sharedMessageId = providedMessageId || recordId;
    const mirrorMessageId = crypto.randomUUID();

    // Store message for sender's contact
    tableContactMessage.createMessage(req.database.db, {
      id: recordId,
      messageId: sharedMessageId,
      contactId,
      direction,
      encryptedMessage: encryptedMessageForUser,
      signature,
      status,
      createdAt
    }, (err) => {
      if (err) {
        return res.status(500).json({ status: 500, error: err.message || err });
      }
      // Try to find reciprocal contact and store mirrored message for recipient
      tableContact.getByUserAndContactUser(req.database.db, contactUserId, userId, (lookupErr, reciprocal) => {
        if (!lookupErr && reciprocal?.id) {
          tableContactMessage.createMessage(req.database.db, {
            id: mirrorMessageId,
            messageId: sharedMessageId,
            contactId: reciprocal.id,
            direction: 'contactUser',
            encryptedMessage: encryptedMessageForContact,
            signature,
            status: 'delivered',
            createdAt
          }, () => { /* ignore errors for mirror insert */ });
        }
        return res.status(200).json({
          status: 200,
          messageId: recordId,
          mirrorMessageId,
          sharedMessageId
        });
      });
    });
  }
);

// List messages (paged, optional before timestamp)
router.get('/list/:contactId',
  [
    security.authenticate
  ],
  (req, res) => {
    const contactId = req.params.contactId;
    const limit = Math.max(1, Math.min(200, parseInt(req.query.limit, 10) || 100));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const before = req.query.before;

    tableContactMessage.getActiveByContact(req.database.db, contactId, limit, offset, before, (err, rows) => {
      if (err) {
        return res.status(500).json({ status: 500, error: err.message || err });
      }
      // Auch bei leeren Ergebnissen 200 zurückgeben, damit das Frontend sauber rendern kann
      return res.status(200).json({ status: 200, rows: rows || [] });
    });
  }
);

// Unread count
router.get('/unread/:contactId',
  [
    security.authenticate
  ],
  (req, res) => {
    tableContactMessage.getUnreadCount(req.database.db, req.params.contactId, (err, cnt) => {
      if (err) {
        return res.status(500).json({ status: 500, error: err.message || err });
      }
      return res.status(200).json({ status: 200, unread: cnt });
    });
  }
);

// Mark messages as read: either by IDs or all (unread) up to timestamp for a contact
router.post('/read',
  [
    security.authenticate,
    express.json({ type: 'application/json' })
  ],
  (req, res) => {
    const { messageIds, contactId, before } = req.body;

    if (Array.isArray(messageIds) && messageIds.length > 0) {
      let remaining = messageIds.length;
      let errored = false;
      messageIds.forEach((id) => {
        tableContactMessage.markAsRead(req.database.db, id, (err) => {
          if (errored) {
            return;
          }
          if (err) {
            errored = true;
            return res.status(500).json({ status: 500, error: err.message || err });
          }
          remaining -= 1;
          if (remaining === 0) {
            return res.status(200).json({ status: 200, updated: messageIds.length });
          }
        });
      });
      return;
    }

    if (contactId) {
      tableContactMessage.markManyAsReadByContact(req.database.db, contactId, before, (err) => {
        if (err) {
          return res.status(500).json({ status: 500, error: err.message || err });
        }
        return res.status(200).json({ status: 200 });
      });
      return;
    }

    return res.status(400).json({ status: 400, error: 'Provide messageIds or contactId' });
  }
);

module.exports = router;
