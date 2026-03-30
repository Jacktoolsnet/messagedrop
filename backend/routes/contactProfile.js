const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const security = require('../middleware/security');
const metric = require('../middleware/metric');
const tableContact = require('../db/tableContact');
const tableUser = require('../db/tableUser');
const tableContactProfileExchange = require('../db/tableContactProfileExchange');
const { apiError } = require('../middleware/api-error');
const { signServiceJwt } = require('../utils/serviceJwt');
const { resolveBaseUrl } = require('../utils/adminLogForwarder');

const router = express.Router();

const SOCKET_AUDIENCE = process.env.SERVICE_JWT_AUDIENCE_SOCKET || 'service.socketio';
const REQUEST_TTL_SECONDS = Math.max(60, Number.parseInt(process.env.CONTACT_PROFILE_REQUEST_TTL_SECONDS ?? '', 10) || (7 * 24 * 60 * 60));
const RESPONSE_TTL_SECONDS = Math.max(60, Number.parseInt(process.env.CONTACT_PROFILE_RESPONSE_TTL_SECONDS ?? '', 10) || (7 * 24 * 60 * 60));
const MAX_PROFILE_PAYLOAD_BYTES = Math.max(1024, Number.parseInt(process.env.CONTACT_PROFILE_MAX_BYTES ?? '', 10) || 1_500_000);

function resolveSocketIoBaseUrl() {
  return resolveBaseUrl(process.env.SOCKETIO_BASE_URL || process.env.BASE_URL, process.env.SOCKETIO_PORT);
}

async function emitProfileExchangeUpdate(userId) {
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
        type: 'contact_profile_exchange_updated',
        content: {
          userId
        }
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

function getContactOwnedByUser(db, contactId) {
  return new Promise((resolve, reject) => {
    tableContact.getById(db, contactId, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row ?? null);
    });
  });
}

function getUserById(db, userId) {
  return new Promise((resolve, reject) => {
    tableUser.getById(db, userId, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row ?? null);
    });
  });
}

function getActiveExchange(db, requesterContactId, recipientUserId) {
  return new Promise((resolve, reject) => {
    tableContactProfileExchange.getActiveByRequesterContact(db, requesterContactId, recipientUserId, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row ?? null);
    });
  });
}

function createPendingExchange(db, exchange) {
  return new Promise((resolve, reject) => {
    tableContactProfileExchange.createPending(db, exchange, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function listPendingInbox(db, userId, limit = 100) {
  return new Promise((resolve, reject) => {
    tableContactProfileExchange.listPendingForRecipient(db, userId, limit, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows ?? []);
    });
  });
}

function listResolvedResponses(db, userId, limit = 100) {
  return new Promise((resolve, reject) => {
    tableContactProfileExchange.listResolvedForRequester(db, userId, limit, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows ?? []);
    });
  });
}

function respondToExchange(db, exchangeId, recipientUserId, response) {
  return new Promise((resolve, reject) => {
    tableContactProfileExchange.respond(db, exchangeId, recipientUserId, response, (err, changes) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(changes ?? 0);
    });
  });
}

function deleteResponsesForRequester(db, requesterUserId, exchangeIds) {
  return new Promise((resolve, reject) => {
    tableContactProfileExchange.deleteByRequesterAndIds(db, requesterUserId, exchangeIds, (err, changes) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(changes ?? 0);
    });
  });
}

function isUniqueConstraintError(error) {
  const message = String(error?.message || '');
  return error?.code === 'SQLITE_CONSTRAINT'
    || error?.code === 'SQLITE_CONSTRAINT_UNIQUE'
    || /UNIQUE constraint failed/i.test(message);
}

function mapInboxRow(row) {
  return {
    id: row.id,
    requesterUserId: row.requesterUserId,
    requesterContactId: row.requesterContactId,
    requesterHint: row.requesterHint ?? '',
    requesterEncryptionPublicKey: row.requesterEncryptionPublicKey,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt
  };
}

function mapResponseRow(row) {
  return {
    id: row.id,
    requesterContactId: row.requesterContactId,
    recipientUserId: row.recipientUserId,
    status: row.status,
    encryptedProfilePayload: row.encryptedProfilePayload ?? '',
    responseSignature: row.responseSignature ?? '',
    createdAt: row.createdAt,
    decidedAt: row.decidedAt,
    expiresAt: row.expiresAt
  };
}

router.post('/request', [
  security.authenticate,
  express.json({ type: 'application/json' }),
  metric.count('contactProfile.request', { when: 'always', timezone: 'utc', amount: 1 })
], async (req, res, next) => {
  const { contactId } = req.body ?? {};
  if (!contactId) {
    return next(apiError.badRequest('missing_contactId'));
  }

  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return next(apiError.unauthorized('unauthorized'));
  }

  try {
    const contact = await getContactOwnedByUser(req.database.db, contactId);
    if (!contact) {
      return next(apiError.notFound('not_found'));
    }
    if (!ensureSameUser(req, res, contact.userId, next)) {
      return;
    }
    if (!contact.contactUserId) {
      return next(apiError.badRequest('missing_contact_user'));
    }

    const requester = await getUserById(req.database.db, authUserId);
    if (!requester?.cryptoPublicKey) {
      return next(apiError.custom(409, 'requester_public_key_missing'));
    }

    const recipient = await getUserById(req.database.db, contact.contactUserId);
    if (!recipient?.id) {
      return next(apiError.notFound('recipient_not_found'));
    }

    const exchange = {
      id: crypto.randomUUID(),
      requesterUserId: authUserId,
      requesterContactId: contact.id,
      recipientUserId: contact.contactUserId,
      requesterHint: contact.hint ?? null,
      requesterEncryptionPublicKey: requester.cryptoPublicKey,
      expiresAt: Math.floor(Date.now() / 1000) + REQUEST_TTL_SECONDS
    };

    try {
      await createPendingExchange(req.database.db, exchange);
      void emitProfileExchangeUpdate(exchange.recipientUserId);
      return res.status(200).json({
        status: 200,
        exchangeId: exchange.id,
        exchangeStatus: tableContactProfileExchange.exchangeStatus.PENDING,
        alreadyExists: false
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const existing = await getActiveExchange(req.database.db, contact.id, contact.contactUserId);
      if (!existing) {
        throw error;
      }
      if (existing.status !== tableContactProfileExchange.exchangeStatus.PENDING) {
        void emitProfileExchangeUpdate(authUserId);
      }
      return res.status(200).json({
        status: 200,
        exchangeId: existing.id,
        exchangeStatus: existing.status,
        alreadyExists: true
      });
    }
  } catch {
    return next(apiError.internal('db_error'));
  }
});

router.get('/inbox', [
  security.authenticate,
  metric.count('contactProfile.inbox', { when: 'always', timezone: 'utc', amount: 1 })
], async (req, res, next) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return next(apiError.unauthorized('unauthorized'));
  }

  try {
    const rows = await listPendingInbox(req.database.db, authUserId, 100);
    return res.status(200).json({
      status: 200,
      rows: rows.map(mapInboxRow)
    });
  } catch {
    return next(apiError.internal('db_error'));
  }
});

router.post('/respond', [
  security.authenticate,
  express.json({ type: 'application/json', limit: '2mb' }),
  metric.count('contactProfile.respond', { when: 'always', timezone: 'utc', amount: 1 })
], async (req, res, next) => {
  const {
    exchangeId,
    approved,
    encryptedProfilePayload,
    responseSignature
  } = req.body ?? {};

  if (!exchangeId || typeof approved !== 'boolean') {
    return next(apiError.badRequest('missing_required_fields'));
  }

  if (approved) {
    if (!encryptedProfilePayload || !responseSignature) {
      return next(apiError.badRequest('missing_encrypted_profile_payload'));
    }
    if (Buffer.byteLength(encryptedProfilePayload, 'utf8') > MAX_PROFILE_PAYLOAD_BYTES) {
      return next(apiError.custom(413, 'encrypted_profile_payload_too_large'));
    }
    if (Buffer.byteLength(responseSignature, 'utf8') > 20000) {
      return next(apiError.custom(413, 'response_signature_too_large'));
    }
  }

  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return next(apiError.unauthorized('unauthorized'));
  }

  try {
    const exchange = await new Promise((resolve, reject) => {
      tableContactProfileExchange.getById(req.database.db, exchangeId, (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row ?? null);
      });
    });

    if (!exchange) {
      return next(apiError.notFound('not_found'));
    }
    if (String(exchange.recipientUserId) !== String(authUserId)) {
      return next(apiError.forbidden('forbidden'));
    }
    if (exchange.status !== tableContactProfileExchange.exchangeStatus.PENDING) {
      return next(apiError.custom(409, 'exchange_not_pending'));
    }

    const changes = await respondToExchange(req.database.db, exchangeId, authUserId, {
      status: approved
        ? tableContactProfileExchange.exchangeStatus.APPROVED
        : tableContactProfileExchange.exchangeStatus.DECLINED,
      encryptedProfilePayload: approved ? encryptedProfilePayload : null,
      responseSignature: approved ? responseSignature : null,
      expiresAt: Math.floor(Date.now() / 1000) + RESPONSE_TTL_SECONDS
    });

    if (changes === 0) {
      return next(apiError.custom(409, 'exchange_not_pending'));
    }

    void emitProfileExchangeUpdate(exchange.requesterUserId);
    return res.status(200).json({
      status: 200,
      exchangeId,
      exchangeStatus: approved
        ? tableContactProfileExchange.exchangeStatus.APPROVED
        : tableContactProfileExchange.exchangeStatus.DECLINED
    });
  } catch {
    return next(apiError.internal('db_error'));
  }
});

router.get('/responses', [
  security.authenticate,
  metric.count('contactProfile.responses', { when: 'always', timezone: 'utc', amount: 1 })
], async (req, res, next) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return next(apiError.unauthorized('unauthorized'));
  }

  try {
    const rows = await listResolvedResponses(req.database.db, authUserId, 100);
    return res.status(200).json({
      status: 200,
      rows: rows.map(mapResponseRow)
    });
  } catch {
    return next(apiError.internal('db_error'));
  }
});

router.post('/ack', [
  security.authenticate,
  express.json({ type: 'application/json' }),
  metric.count('contactProfile.ack', { when: 'always', timezone: 'utc', amount: 1 })
], async (req, res, next) => {
  const { exchangeIds } = req.body ?? {};
  if (!Array.isArray(exchangeIds) || exchangeIds.length === 0) {
    return next(apiError.badRequest('missing_exchangeIds'));
  }

  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return next(apiError.unauthorized('unauthorized'));
  }

  try {
    const deleted = await deleteResponsesForRequester(req.database.db, authUserId, exchangeIds);
    return res.status(200).json({
      status: 200,
      deleted
    });
  } catch {
    return next(apiError.internal('db_error'));
  }
});

module.exports = router;
