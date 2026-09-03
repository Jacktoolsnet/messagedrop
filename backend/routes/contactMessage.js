const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const tableContact = require('../db/tableContact');

const security = require('../middleware/security');
const metric = require('../middleware/metric');
const tableContactMessage = require('../db/tableContactMessage');
const notify = require('../utils/notify');
const { deliverContactMessage } = require('../utils/socketDelivery');
const { apiError } = require('../middleware/api-error');
const { createUtcTimestamp, normalizeUtcTimestamp } = require('../utils/utcTimestamp');

const DEFAULT_MAX_MESSAGE_BYTES = 1_500_000;
const DEFAULT_CONTACT_PUSH_BODY = 'You have received a new chat message.';
const MAX_MESSAGE_BYTES = (() => {
  const raw = process.env.CONTACT_MESSAGE_MAX_BYTES;
  if (!raw) return DEFAULT_MAX_MESSAGE_BYTES;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_MESSAGE_BYTES;
})();
const CONTACT_PUSH_BODY = (process.env.CONTACT_PUSH_BODY || DEFAULT_CONTACT_PUSH_BODY).trim() || DEFAULT_CONTACT_PUSH_BODY;

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
  if (Buffer.byteLength(body.encryptedMessageForUser, 'utf8') > MAX_MESSAGE_BYTES) {
    return 'encryptedMessageForUser_too_large';
  }
  if (Buffer.byteLength(body.encryptedMessageForContact, 'utf8') > MAX_MESSAGE_BYTES) {
    return 'encryptedMessageForContact_too_large';
  }
  return null;
};

// Create/send a message (server-side persist; sockets informieren separat)
router.post('/send',
  [
    security.authenticate,
    express.json({ type: 'application/json', limit: '2mb' }),
    metric.count('contactMessage.send', { when: 'always', timezone: 'utc', amount: 1 })
  ],
  (req, res, next) => {
    const validationError = validateSendBody(req.body);
    if (validationError) {
      const code = validationError.endsWith('_too_large') ? 413 : 400;
      return next(apiError.custom(code, validationError));
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
      messageId: providedMessageId,
      notificationType
    } = req.body;

    const normalizedNotificationType = ['game_started', 'game_move', 'decision_started', 'decision_result'].includes(notificationType)
      ? notificationType
      : null;

    if (!ensureSameUser(req, res, userId, next)) {
      return;
    }

    const recordId = id || crypto.randomUUID();
    const sharedMessageId = providedMessageId || recordId;
    const mirrorMessageId = crypto.randomUUID();
    const messageCreatedAt = normalizeUtcTimestamp(createdAt) || createUtcTimestamp();

    // Store message for sender's contact
    withContactOwnership(req, res, contactId, (contactRow) => {
      if ((contactRow.status || 'active') !== 'active') {
        return next(apiError.forbidden('contact_removed'));
      }

      tableContactMessage.createMessage(req.database.db, {
        id: recordId,
        messageId: sharedMessageId,
        contactId,
        direction,
        message: encryptedMessageForUser,
        signature,
        status,
        createdAt: messageCreatedAt
      }, (err) => {
        if (err) {
          return next(apiError.internal('db_error'));
        }
        // Try to find reciprocal contact and store mirrored message for recipient
        tableContact.getByUserAndContactUser(req.database.db, contactUserId, userId, (lookupErr, reciprocal) => {
          const respond = (socketDelivered = false) => res.status(200).json({
            status: 200,
            messageId: recordId,
            mirrorMessageId,
            sharedMessageId,
            createdAt: messageCreatedAt,
            socketDelivered
          });
          if (!lookupErr && reciprocal?.id && (reciprocal.status || 'active') === 'active') {
            tableContactMessage.createMessage(req.database.db, {
              id: mirrorMessageId,
              messageId: sharedMessageId,
              contactId: reciprocal.id,
              direction: 'contactUser',
              message: encryptedMessageForContact,
              signature,
              status: 'delivered',
              createdAt: messageCreatedAt
            }, async (mirrorErr) => {
              if (mirrorErr) {
                req.logger?.warn?.('contactMessage.send mirror insert failed; skipping push notification', {
                  error: mirrorErr?.message,
                  userId,
                  contactUserId,
                  contactId,
                  reciprocalContactId: reciprocal.id
                });
                return respond(false);
              }
              const envelope = {
                id: mirrorMessageId,
                messageId: sharedMessageId,
                contactId,
                userId,
                contactUserId,
                messageSignature: signature,
                userEncryptedMessage: encryptedMessageForUser,
                contactUserEncryptedMessage: encryptedMessageForContact,
                createdAt: messageCreatedAt
              };
              const socketDelivered = await deliverContactMessage(req.logger, envelope);
              if (socketDelivered) {
                req.logger?.info?.('Web Push suppressed after acknowledged live Socket.IO delivery', {
                  userId,
                  contactUserId,
                  messageId: sharedMessageId,
                  notificationType: normalizedNotificationType || 'message'
                });
              } else {
                notify.contactSubscriptions(
                  req.logger,
                  req.database.db,
                  userId,
                  contactUserId,
                  CONTACT_PUSH_BODY,
                  sharedMessageId,
                  normalizedNotificationType
                );
              }
              return respond(socketDelivered);
            });
          } else if (lookupErr) {
            req.logger?.warn?.('contactMessage.send reciprocal lookup failed; skipping push notification', {
              error: lookupErr?.message,
              userId,
              contactUserId,
              contactId
            });
          }
          if (lookupErr || !reciprocal?.id || (reciprocal.status || 'active') !== 'active') return respond(false);
          return undefined;
        });
      });
    }, next);
  }
);

// Update existing message (shared messageId)
router.post('/update',
  [
    security.authenticate,
    express.json({ type: 'application/json', limit: '2mb' }),
    metric.count('contactMessage.update', { when: 'always', timezone: 'utc', amount: 1 })
  ],
  (req, res, next) => {
    const {
      messageId,
      contactId,
      encryptedMessageForUser,
      encryptedMessageForContact,
      signature,
      status,
      userId,
      contactUserId
    } = req.body ?? {};

    if (!messageId || !contactId || !encryptedMessageForUser || !encryptedMessageForContact || !signature || !userId || !contactUserId) {
      return next(apiError.badRequest('missing_required_fields'));
    }
    if (Buffer.byteLength(encryptedMessageForUser, 'utf8') > MAX_MESSAGE_BYTES
      || Buffer.byteLength(encryptedMessageForContact, 'utf8') > MAX_MESSAGE_BYTES) {
      return next(apiError.custom(413, 'encrypted_message_too_large'));
    }

    if (!ensureSameUser(req, res, userId, next)) {
      return;
    }

    withContactOwnership(req, res, contactId, (contactRow) => {
      if ((contactRow.status || 'active') !== 'active') {
        return next(apiError.forbidden('contact_removed'));
      }

      tableContactMessage.updateMessageForContact(req.database.db, contactId, messageId, {
        message: encryptedMessageForUser,
        signature,
        status
      }, (err) => {
        if (err) {
          return next(apiError.internal('db_error'));
        }

        tableContact.getByUserAndContactUser(req.database.db, contactUserId, userId, (lookupErr, reciprocal) => {
          if (!lookupErr && reciprocal?.id && (reciprocal.status || 'active') === 'active') {
            tableContactMessage.updateMessageForContact(req.database.db, reciprocal.id, messageId, {
              message: encryptedMessageForContact,
              signature,
              status
            }, () => { /* best-effort */ });
          }
          return res.status(200).json({ status: 200, messageId });
        });
      });
    }, next);
  }
);

// Store translation for a single contact copy
router.post('/translate',
  [
    security.authenticate,
    express.json({ type: 'application/json', limit: '2mb' }),
    metric.count('contactMessage.translate', { when: 'always', timezone: 'utc', amount: 1 })
  ],
  (req, res, next) => {
    const { messageId, contactId, translatedMessage, userId } = req.body ?? {};
    if (!messageId || !contactId || !translatedMessage || !userId) {
      return next(apiError.badRequest('missing_required_fields'));
    }

    if (!ensureSameUser(req, res, userId, next)) {
      return;
    }

    withContactOwnership(req, res, contactId, () => {
      tableContactMessage.setTranslatedMessageForContact(req.database.db, contactId, messageId, translatedMessage, (err) => {
        if (err) {
          return next(apiError.internal('db_error'));
        }
        return res.status(200).json({ status: 200, messageId });
      });
    }, next);
  }
);

// Delete message(s)
router.post('/delete',
  [
    security.authenticate,
    express.json({ type: 'application/json', limit: '2mb' }),
    metric.count('contactMessage.delete', { when: 'always', timezone: 'utc', amount: 1 })
  ],
  (req, res, next) => {
    const {
      messageId,
      messageIds,
      contactId,
      scope = 'single',
      userId,
      contactUserId
    } = req.body ?? {};

    const normalizedMessageIds = [...new Set([
      ...(Array.isArray(messageIds) ? messageIds : []),
      messageId
    ]
      .map((id) => (typeof id === 'string' ? id.trim() : ''))
      .filter(Boolean))];

    if (!contactId || normalizedMessageIds.length === 0 || normalizedMessageIds.length > 200) {
      return next(apiError.badRequest('missing_required_fields'));
    }

    if (scope === 'both') {
      if (!ensureSameUser(req, res, userId, next)) {
        return;
      }
      return withContactOwnership(req, res, contactId, () => {
        tableContactMessage.deleteByMessageIds(req.database.db, normalizedMessageIds, (err, deletedCount) => {
          if (err) {
            return next(apiError.internal('db_error'));
          }
          return res.status(200).json({ status: 200, messageId, messageIds: normalizedMessageIds, deletedCount });
        });
      }, next);
    }

    if (!ensureSameUser(req, res, userId, next)) {
      return;
    }

    withContactOwnership(req, res, contactId, () => {
      tableContactMessage.deleteByContactAndMessageIds(req.database.db, contactId, normalizedMessageIds, (err, deletedCount) => {
        if (err) {
          return next(apiError.internal('db_error'));
        }
        // Mark reciprocal as deleted (if exists)
        if (userId && contactUserId) {
          tableContact.getByUserAndContactUser(req.database.db, contactUserId, userId, (lookupErr, reciprocal) => {
            if (!lookupErr && reciprocal?.id) {
              normalizedMessageIds.forEach((id) => {
                tableContactMessage.updateMessageForContact(req.database.db, reciprocal.id, id, {
                  status: 'deleted'
                }, () => { /* best-effort */ });
              });
            }
          });
        }
        return res.status(200).json({ status: 200, messageId, messageIds: normalizedMessageIds, deletedCount });
      });
    }, next);
  }
);

// Clear the authenticated user's local history for one contact.
router.post('/clear',
  [
    security.authenticate,
    express.json({ type: 'application/json' }),
    metric.count('contactMessage.clear', { when: 'always', timezone: 'utc', amount: 1 })
  ],
  (req, res, next) => {
    const { contactId, userId } = req.body ?? {};
    if (!contactId || !userId) {
      return next(apiError.badRequest('missing_required_fields'));
    }
    if (!ensureSameUser(req, res, userId, next)) {
      return;
    }

    withContactOwnership(req, res, contactId, () => {
      tableContactMessage.getMessageIdsByContact(req.database.db, contactId, (listErr, rows) => {
        if (listErr) {
          return next(apiError.internal('db_error'));
        }
        const messageIds = [...new Set(rows.map((row) => row.messageId).filter(Boolean))];
        tableContactMessage.deleteByContactId(req.database.db, contactId, (deleteErr) => {
          if (deleteErr) {
            return next(apiError.internal('db_error'));
          }
          tableContact.clearLastMessage(req.database.db, contactId, (contactErr) => {
            if (contactErr) {
              return next(apiError.internal('db_error'));
            }
            return res.status(200).json({ status: 200, messageIds });
          });
        });
      });
    }, next);
  }
);

// React to a message (single reaction shared across both copies)
router.post('/reaction',
  [
    security.authenticate,
    express.json({ type: 'application/json' }),
    metric.count('contactMessage.reaction', { when: 'always', timezone: 'utc', amount: 1 })
  ],
  (req, res, next) => {
    const { messageId, contactId, userId, contactUserId, reaction } = req.body ?? {};
    if (!messageId || !contactId || !userId || !contactUserId) {
      return next(apiError.badRequest('missing_required_fields'));
    }

    if (!ensureSameUser(req, res, userId, next)) {
      return;
    }

    withContactOwnership(req, res, contactId, () => {
      tableContactMessage.setReactionForContact(req.database.db, contactId, messageId, reaction ?? null, (err) => {
        if (err) {
          return next(apiError.internal('db_error'));
        }
        tableContact.getByUserAndContactUser(req.database.db, contactUserId, userId, (lookupErr, reciprocal) => {
          if (!lookupErr && reciprocal?.id) {
            tableContactMessage.setReactionForContact(req.database.db, reciprocal.id, messageId, reaction ?? null, () => { /* best-effort */ });
          }
          return res.status(200).json({ status: 200, messageId, reaction: reaction ?? null });
        });
      });
    }, next);
  }
);

// Mark as read (both copies)
router.post('/status/read',
  [
    security.authenticate,
    express.json({ type: 'application/json' }),
    metric.count('contactMessage.status.read', { when: 'always', timezone: 'utc', amount: 1 })
  ],
  (req, res, next) => {
    const { messageId, contactId, userId, contactUserId } = req.body ?? {};
    if (!messageId || !contactId || !userId || !contactUserId) {
      return next(apiError.badRequest('missing_required_fields'));
    }

    if (!ensureSameUser(req, res, userId, next)) {
      return;
    }

    withContactOwnership(req, res, contactId, () => {
      tableContactMessage.markAsReadByContactAndMessageId(req.database.db, contactId, messageId, (err) => {
        if (err) {
          return next(apiError.internal('db_error'));
        }
        tableContact.getByUserAndContactUser(req.database.db, contactUserId, userId, (lookupErr, reciprocal) => {
          if (!lookupErr && reciprocal?.id) {
            tableContactMessage.markAsReadByContactAndMessageId(req.database.db, reciprocal.id, messageId, () => { });
          }
          return res.status(200).json({ status: 200, messageId });
        });
      });
    }, next);
  }
);

// List messages (paged, optional before timestamp)
router.get('/list/:contactId',
  [
    security.authenticate
  ],
  (req, res, next) => {
    const contactId = req.params.contactId;
    const limit = Math.max(1, Math.min(200, parseInt(req.query.limit, 10) || 100));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const before = req.query.before;

    withContactOwnership(req, res, contactId, () => {
      tableContactMessage.getActiveByContact(req.database.db, contactId, limit, offset, before, (err, rows) => {
        if (err) {
          return next(apiError.internal('db_error'));
        }
        // Auch bei leeren Ergebnissen 200 zurückgeben, damit das Frontend sauber rendern kann
        const normalizedRows = (rows || []).map((row) => ({
          ...row,
          createdAt: normalizeUtcTimestamp(row.createdAt) || row.createdAt,
          readAt: row.readAt ? (normalizeUtcTimestamp(row.readAt) || row.readAt) : null
        }));
        return res.status(200).json({ status: 200, rows: normalizedRows });
      });
    }, next);
  }
);

// Unread count
router.get('/unread/:contactId',
  [
    security.authenticate
  ],
  (req, res, next) => {
    const contactId = req.params.contactId;
    withContactOwnership(req, res, contactId, () => {
      tableContactMessage.getUnreadCount(req.database.db, contactId, (err, cnt) => {
        if (err) {
          return next(apiError.internal('db_error'));
        }
        return res.status(200).json({ status: 200, unread: cnt });
      });
    }, next);
  }
);

// Sync deleted message ids for local payload cleanup (delta by cursor)
router.get('/sync/:contactId',
  [
    security.authenticate
  ],
  (req, res, next) => {
    const contactId = req.params.contactId;
    const sinceRaw = Number.parseInt(String(req.query.since ?? '0'), 10);
    const limitRaw = Number.parseInt(String(req.query.limit ?? '500'), 10);
    const since = Number.isFinite(sinceRaw) ? Math.max(0, sinceRaw) : 0;
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(1000, limitRaw)) : 500;

    withContactOwnership(req, res, contactId, () => {
      tableContactMessage.getDeletedEventsByContact(req.database.db, contactId, since, limit, (err, result) => {
        if (err) {
          return next(apiError.internal('db_error'));
        }
        return res.status(200).json({
          status: 200,
          purgedMessageIds: result?.messageIds ?? [],
          nextCursor: result?.nextCursor ?? since
        });
      });
    }, next);
  }
);

// Mark messages as read: either by IDs or all (unread) up to timestamp for a contact
router.post('/read',
  [
    security.authenticate,
    express.json({ type: 'application/json' })
  ],
  (req, res, next) => {
    const { messageIds, contactId, before } = req.body ?? {};
    if (!contactId) {
      return next(apiError.badRequest('missing_contactId'));
    }

    withContactOwnership(req, res, contactId, () => {
      if (Array.isArray(messageIds) && messageIds.length > 0) {
        const normalizedMessageIds = [...new Set(messageIds
          .map((id) => (typeof id === 'string' ? id.trim() : ''))
          .filter(Boolean))];
        if (normalizedMessageIds.length === 0) {
          return next(apiError.badRequest('invalid_messageIds'));
        }

        let remaining = normalizedMessageIds.length;
        let errored = false;
        normalizedMessageIds.forEach((messageId) => {
          tableContactMessage.markAsReadByContactAndMessageId(req.database.db, contactId, messageId, (err) => {
            if (errored) {
              return;
            }
            if (err) {
              errored = true;
              return next(apiError.internal('db_error'));
            }
            remaining -= 1;
            if (remaining === 0) {
              return res.status(200).json({ status: 200, updated: normalizedMessageIds.length });
            }
          });
        });
        return;
      }

      tableContactMessage.markManyAsReadByContact(req.database.db, contactId, before, (err) => {
        if (err) {
          return next(apiError.internal('db_error'));
        }
        return res.status(200).json({ status: 200 });
      });
    }, next);
  }
);

// Acknowledge message payload persisted locally and clear encrypted payload on server
router.post('/payload/ack',
  [
    security.authenticate,
    express.json({ type: 'application/json' }),
    metric.count('contactMessage.payload.ack', { when: 'always', timezone: 'utc', amount: 1 })
  ],
  (req, res, next) => {
    const { contactId, messageIds } = req.body ?? {};
    if (!contactId || !Array.isArray(messageIds) || messageIds.length === 0) {
      return next(apiError.badRequest('missing_required_fields'));
    }
    const normalizedMessageIds = [...new Set(messageIds
      .map((id) => (typeof id === 'string' ? id.trim() : ''))
      .filter(Boolean))];
    if (normalizedMessageIds.length === 0) {
      return next(apiError.badRequest('invalid_messageIds'));
    }

    withContactOwnership(req, res, contactId, () => {
      tableContactMessage.clearPayloadByContactAndMessageIds(
        req.database.db,
        contactId,
        normalizedMessageIds,
        (err, updated) => {
          if (err) {
            return next(apiError.internal('db_error'));
          }
          return res.status(200).json({ status: 200, updated: updated ?? 0 });
        }
      );
    }, next);
  }
);

module.exports = router;
