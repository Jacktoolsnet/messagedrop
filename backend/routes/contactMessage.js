const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const tableContact = require('../db/tableContact');

const security = require('../middleware/security');
const metric = require('../middleware/metric');
const tableContactMessage = require('../db/tableContactMessage');

router.use(security.checkToken);

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
    handler(row);
  });
}

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

    if (!ensureSameUser(req, res, userId)) {
      return;
    }

    const recordId = id || crypto.randomUUID();
    const sharedMessageId = providedMessageId || recordId;
    const mirrorMessageId = crypto.randomUUID();

    // Store message for sender's contact
    withContactOwnership(req, res, contactId, () => {
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
    });
  }
);

// Update existing message (shared messageId)
router.post('/update',
  [
    security.authenticate,
    express.json({ type: 'application/json' }),
    metric.count('contactMessage.update', { when: 'always', timezone: 'utc', amount: 1 })
  ],
  (req, res) => {
    const {
      messageId,
      contactId,
      encryptedMessageForUser,
      encryptedMessageForContact,
      signature,
      status = 'sent',
      userId,
      contactUserId
    } = req.body ?? {};

    if (!messageId || !contactId || !encryptedMessageForUser || !encryptedMessageForContact || !signature || !userId || !contactUserId) {
      return res.status(400).json({ status: 400, error: 'Missing required fields' });
    }

    if (!ensureSameUser(req, res, userId)) {
      return;
    }

    withContactOwnership(req, res, contactId, () => {
      tableContactMessage.updateMessageForContact(req.database.db, contactId, messageId, {
        encryptedMessage: encryptedMessageForUser,
        signature,
        status
      }, (err) => {
        if (err) {
          return res.status(500).json({ status: 500, error: err.message || err });
        }

        tableContact.getByUserAndContactUser(req.database.db, contactUserId, userId, (lookupErr, reciprocal) => {
          if (!lookupErr && reciprocal?.id) {
            tableContactMessage.updateMessageForContact(req.database.db, reciprocal.id, messageId, {
              encryptedMessage: encryptedMessageForContact,
              signature,
              status
            }, () => { /* best-effort */ });
          }
          return res.status(200).json({ status: 200, messageId });
        });
      });
    });
  }
);

// Store translation for a single contact copy
router.post('/translate',
  [
    security.authenticate,
    express.json({ type: 'application/json' }),
    metric.count('contactMessage.translate', { when: 'always', timezone: 'utc', amount: 1 })
  ],
  (req, res) => {
    const { messageId, contactId, translatedMessage, userId } = req.body ?? {};
    if (!messageId || !contactId || !translatedMessage || !userId) {
      return res.status(400).json({ status: 400, error: 'Missing required fields' });
    }

    if (!ensureSameUser(req, res, userId)) {
      return;
    }

    withContactOwnership(req, res, contactId, () => {
      tableContactMessage.setTranslatedMessageForContact(req.database.db, contactId, messageId, translatedMessage, (err) => {
        if (err) {
          return res.status(500).json({ status: 500, error: err.message || err });
        }
        return res.status(200).json({ status: 200, messageId });
      });
    });
  }
);

// Delete message(s)
router.post('/delete',
  [
    security.authenticate,
    express.json({ type: 'application/json' }),
    metric.count('contactMessage.delete', { when: 'always', timezone: 'utc', amount: 1 })
  ],
  (req, res) => {
    const {
      messageId,
      contactId,
      scope = 'single',
      userId,
      contactUserId
    } = req.body ?? {};

    if (!messageId || !contactId) {
      return res.status(400).json({ status: 400, error: 'Missing required fields' });
    }

    if (scope === 'both') {
      if (!ensureSameUser(req, res, userId)) {
        return;
      }
      return withContactOwnership(req, res, contactId, () => {
        tableContactMessage.deleteByMessageId(req.database.db, messageId, (err) => {
          if (err) {
            return res.status(500).json({ status: 500, error: err.message || err });
          }
          return res.status(200).json({ status: 200, messageId });
        });
      });
    }

    if (!ensureSameUser(req, res, userId)) {
      return;
    }

    withContactOwnership(req, res, contactId, () => {
      tableContactMessage.deleteByContactAndMessageId(req.database.db, contactId, messageId, (err) => {
        if (err) {
          return res.status(500).json({ status: 500, error: err.message || err });
        }
        // Mark reciprocal as deleted (if exists)
        if (userId && contactUserId) {
          tableContact.getByUserAndContactUser(req.database.db, contactUserId, userId, (lookupErr, reciprocal) => {
            if (!lookupErr && reciprocal?.id) {
              tableContactMessage.updateMessageForContact(req.database.db, reciprocal.id, messageId, {
                status: 'deleted'
              }, () => { /* best-effort */ });
            }
          });
        }
        return res.status(200).json({ status: 200, messageId });
      });
    });
  }
);

// React to a message (single reaction shared across both copies)
router.post('/reaction',
  [
    security.authenticate,
    express.json({ type: 'application/json' }),
    metric.count('contactMessage.reaction', { when: 'always', timezone: 'utc', amount: 1 })
  ],
  (req, res) => {
    const { messageId, contactId, userId, contactUserId, reaction } = req.body ?? {};
    if (!messageId || !contactId || !userId || !contactUserId) {
      return res.status(400).json({ status: 400, error: 'Missing required fields' });
    }

    if (!ensureSameUser(req, res, userId)) {
      return;
    }

    withContactOwnership(req, res, contactId, () => {
      tableContactMessage.setReactionForContact(req.database.db, contactId, messageId, reaction ?? null, (err) => {
        if (err) {
          return res.status(500).json({ status: 500, error: err.message || err });
        }
        tableContact.getByUserAndContactUser(req.database.db, contactUserId, userId, (lookupErr, reciprocal) => {
          if (!lookupErr && reciprocal?.id) {
            tableContactMessage.setReactionForContact(req.database.db, reciprocal.id, messageId, reaction ?? null, () => { /* best-effort */ });
          }
          return res.status(200).json({ status: 200, messageId, reaction: reaction ?? null });
        });
      });
    });
  }
);

// Mark as read (both copies)
router.post('/status/read',
  [
    security.authenticate,
    express.json({ type: 'application/json' }),
    metric.count('contactMessage.status.read', { when: 'always', timezone: 'utc', amount: 1 })
  ],
  (req, res) => {
    const { messageId, contactId, userId, contactUserId } = req.body ?? {};
    if (!messageId || !contactId || !userId || !contactUserId) {
      return res.status(400).json({ status: 400, error: 'Missing required fields' });
    }

    if (!ensureSameUser(req, res, userId)) {
      return;
    }

    withContactOwnership(req, res, contactId, () => {
      tableContactMessage.markAsReadByContactAndMessageId(req.database.db, contactId, messageId, (err) => {
        if (err) {
          return res.status(500).json({ status: 500, error: err.message || err });
        }
        tableContact.getByUserAndContactUser(req.database.db, contactUserId, userId, (lookupErr, reciprocal) => {
          if (!lookupErr && reciprocal?.id) {
            tableContactMessage.markAsReadByContactAndMessageId(req.database.db, reciprocal.id, messageId, () => { });
          }
          return res.status(200).json({ status: 200, messageId });
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
