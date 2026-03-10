require('dotenv').config();
const { getEncryptionPrivateKey } = require('../utils/keyStore');
const cryptoUtil = require('../utils/cryptoUtils');
const crypto = require('crypto');
const { webcrypto } = crypto;
const { subtle } = webcrypto;
const jwt = require('jsonwebtoken');
const express = require('express');
const axios = require('axios');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const security = require('../middleware/security');
const tableUser = require('../db/tableUser');
const tableUserModerationAppeal = require('../db/tableUserModerationAppeal');
const { normalizeModerationReason } = require('../constants/userModerationReasons');
const tableUsageProtection = require('../db/tableUsageProtection');
const metric = require('../middleware/metric');
const { apiError } = require('../middleware/api-error');
const { signServiceJwt } = require('../utils/serviceJwt');
const { resolveBaseUrl } = require('../utils/adminLogForwarder');

const SOCKET_AUDIENCE = process.env.SERVICE_JWT_AUDIENCE_SOCKET || 'service.socketio';
const ADMIN_AUDIENCE = process.env.SERVICE_JWT_AUDIENCE_ADMIN || 'service.admin-backend';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_RESTORE_CONTACT_ROWS = 5000;
const MAX_RESTORE_PLACE_ROWS = 5000;
const MAX_RESTORE_USER_ROWS = 10000;

function resolveSocketIoBaseUrl() {
  return resolveBaseUrl(process.env.SOCKETIO_BASE_URL || process.env.BASE_URL, process.env.SOCKETIO_PORT);
}

function resolveAdminAuditBaseUrl() {
  return resolveBaseUrl(process.env.ADMIN_BASE_URL, process.env.ADMIN_PORT, process.env.ADMIN_LOG_URL);
}

async function forwardPlatformUserAudit(entry, logger) {
  const baseUrl = resolveAdminAuditBaseUrl();
  if (!baseUrl) {
    return { sent: false };
  }

  try {
    const token = await signServiceJwt({ audience: ADMIN_AUDIENCE });
    const response = await axios.post(`${baseUrl}/audit-log`, entry, {
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      timeout: 3000,
      validateStatus: () => true
    });

    if (response.status >= 200 && response.status < 300) {
      return {
        sent: true,
        id: response.data?.id ?? null
      };
    }

    logger?.warn?.('Platform user audit forward failed', {
      entityType: entry?.entityType,
      entityId: entry?.entityId,
      action: entry?.action,
      status: response.status,
      detail: response.data?.error || response.data?.message || response.statusText || null
    });
  } catch (error) {
    logger?.warn?.('Platform user audit forward failed', {
      entityType: entry?.entityType,
      entityId: entry?.entityId,
      action: entry?.action,
      error: error?.message || error
    });
  }

  return { sent: false };
}

async function emitKeyUpdate(userIds, payload) {
  const baseUrl = resolveSocketIoBaseUrl();
  if (!baseUrl || !Array.isArray(userIds) || !userIds.length) {
    return;
  }
  let token;
  try {
    token = await signServiceJwt({ audience: SOCKET_AUDIENCE });
  } catch {
    return;
  }
  await Promise.all(userIds.map(async (userId) => {
    if (!userId) {
      return;
    }
    try {
      await axios.post(`${baseUrl}/emit/user`, {
        userId,
        event: String(userId),
        payload
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
  }));
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

function queryAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows || []);
    });
  });
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

function parseJsonObject(value) {
  let parsed = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }
  return parsed;
}

function normalizeUsageProtectionPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }
  const settings = parseJsonObject(payload.settings);
  const state = parseJsonObject(payload.state);
  if (!settings || !state) {
    return null;
  }
  return { settings, state };
}

async function buildUserBackup(db, userId) {
  const [
    userRow,
    messages,
    contacts,
    contactMessages,
    places,
    notifications,
    likes,
    dislikes,
    connects,
    usageProtectionRows
  ] = await Promise.all([
    queryGet(db, 'SELECT * FROM tableUser WHERE id = ?', [userId]),
    queryAll(db, 'SELECT * FROM tableMessage WHERE userId = ?', [userId]),
    queryAll(db, 'SELECT * FROM tableContact WHERE userId = ?', [userId]),
    queryAll(db, `
      SELECT cm.*
      FROM tableContactMessage cm
      INNER JOIN tableContact c ON c.id = cm.contactId
      WHERE c.userId = ?;
    `, [userId]),
    queryAll(db, 'SELECT * FROM tablePlace WHERE userId = ?', [userId]),
    queryAll(db, 'SELECT * FROM tableNotification WHERE userId = ?', [userId]),
    queryAll(db, 'SELECT * FROM tableLike WHERE likeUserId = ?', [userId]),
    queryAll(db, 'SELECT * FROM tableDislike WHERE dislikeUserId = ?', [userId]),
    queryAll(db, 'SELECT * FROM tableConnect WHERE userId = ?', [userId]),
    queryAll(db, 'SELECT * FROM tableUsageProtection WHERE userId = ?', [userId])
  ]);

  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    userId,
    tables: {
      tableUser: userRow ? [userRow] : [],
      tableMessage: messages,
      tableContact: contacts,
      tableContactMessage: contactMessages,
      tablePlace: places,
      tableNotification: notifications,
      tableLike: likes,
      tableDislike: dislikes,
      tableConnect: connects,
      tableUsageProtection: usageProtectionRows
    }
  };
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

function normalizeRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows;
}

function createInvalidBackupError() {
  const err = new Error('invalid_backup');
  err.code = 'INVALID_BACKUP';
  return err;
}

function isUuid(value) {
  return UUID_REGEX.test(String(value ?? '').trim());
}

function normalizeText(value, maxLength = 65535) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.slice(0, maxLength);
}

function normalizeOptionalText(value, maxLength = 65535) {
  if (typeof value !== 'string') {
    return null;
  }
  return value.slice(0, maxLength);
}

function normalizeSubscribed(value) {
  return value === true || value === 1 || value === '1' ? 1 : 0;
}

function normalizeTimestamp(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.floor(parsed);
}

function normalizePublicKeyValue(value) {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function normalizeOwnUserType(value) {
  if (typeof value !== 'string') {
    return 'user';
  }
  const normalized = value.trim().toLowerCase();
  return ['user', 'admin', 'business'].includes(normalized) ? normalized : 'user';
}

function normalizeBlockUntil(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.floor(parsed);
}

function hasBlockUntilValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function isAccountBlockedRow(row) {
  if (!row) return false;
  if (String(row.userStatus || '').toLowerCase() !== tableUser.userStatus.DISABLED) {
    return false;
  }
  const until = Number(row.accountBlockedUntil);
  if (Number.isFinite(until) && until > 0 && until < Date.now()) {
    return false;
  }
  return true;
}

function moderationPayloadFromUser(row) {
  if (!row) return null;
  const accountBlocked = isAccountBlockedRow(row);
  const postingBlocked = Number(row.postingBlocked) === 1 && (!Number.isFinite(Number(row.postingBlockedUntil)) || Number(row.postingBlockedUntil) <= 0 || Number(row.postingBlockedUntil) > Date.now());
  return {
    userId: row.id,
    posting: {
      blocked: postingBlocked,
      reason: row.postingBlockedReason || null,
      blockedAt: row.postingBlockedAt || null,
      blockedUntil: row.postingBlockedUntil || null,
      blockedBy: row.postingBlockedBy || null
    },
    account: {
      blocked: accountBlocked,
      reason: row.accountBlockedReason || null,
      blockedAt: row.accountBlockedAt || null,
      blockedUntil: row.accountBlockedUntil || null,
      blockedBy: row.accountBlockedBy || null
    }
  };
}

function isModerationTargetBlocked(moderation, target) {
  if (!moderation || (target !== 'posting' && target !== 'account')) {
    return false;
  }
  return moderation[target]?.blocked === true;
}

function normalizeAppealTarget(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === tableUserModerationAppeal.appealTarget.POSTING
    || normalized === tableUserModerationAppeal.appealTarget.ACCOUNT
    ? normalized
    : null;
}

function normalizeAppealStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === tableUserModerationAppeal.appealStatus.ACCEPTED
    || normalized === tableUserModerationAppeal.appealStatus.REJECTED
    ? normalized
    : null;
}

function normalizeAppealMessage(value, maxLength = 4000) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, maxLength);
}

function listUserModerationAppeals(db, userId) {
  return new Promise((resolve, reject) => {
    tableUserModerationAppeal.listByUserId(db, userId, (err, appeals) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(appeals || []);
    });
  });
}

function listOpenUserModerationAppeals(db, userId, target) {
  return new Promise((resolve, reject) => {
    tableUserModerationAppeal.listOpenByUserIdAndTarget(db, userId, target, (err, appeals) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(appeals || []);
    });
  });
}

function listAllOpenUserModerationAppeals(db, limit) {
  return new Promise((resolve, reject) => {
    tableUserModerationAppeal.listOpen(db, limit, (err, appeals) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(appeals || []);
    });
  });
}

function countAllOpenUserModerationAppeals(db) {
  return new Promise((resolve, reject) => {
    tableUserModerationAppeal.countOpen(db, (err, total) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(Number(total || 0));
    });
  });
}

async function buildUserModerationResponse(db, row) {
  const moderation = moderationPayloadFromUser(row);
  const appeals = row?.id ? await listUserModerationAppeals(db, row.id) : [];
  return {
    moderation,
    appeals
  };
}

async function buildOpenUserModerationAppealsResponse(db, limit) {
  const [appeals, totalOpen] = await Promise.all([
    listAllOpenUserModerationAppeals(db, limit),
    countAllOpenUserModerationAppeals(db)
  ]);
  return {
    appeals,
    totalOpen
  };
}

function getUserRowById(db, userId) {
  return queryGet(db, `
    SELECT *
    FROM tableUser
    WHERE id = ?;
  `, [userId]);
}

function updatePostingBlockAsync(db, userId, options) {
  return new Promise((resolve, reject) => {
    tableUser.updatePostingBlock(db, userId, options, (err, ok) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(Boolean(ok));
    });
  });
}

function updateAccountBlockAsync(db, userId, options) {
  return new Promise((resolve, reject) => {
    tableUser.updateAccountBlock(db, userId, options, (err, ok) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(Boolean(ok));
    });
  });
}

function getModerationAppealById(db, appealId) {
  return new Promise((resolve, reject) => {
    tableUserModerationAppeal.getById(db, appealId, (err, appeal) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(appeal || null);
    });
  });
}

function createModerationAppeal(db, appeal) {
  return new Promise((resolve, reject) => {
    tableUserModerationAppeal.create(db, appeal, (err, createdAppeal) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(createdAppeal || null);
    });
  });
}

function updateModerationAppealResolution(db, appealId, status, resolvedAt, resolutionMessage, reviewer) {
  return new Promise((resolve, reject) => {
    tableUserModerationAppeal.updateResolution(db, appealId, status, resolvedAt, resolutionMessage, reviewer, (err, appeal) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(appeal || null);
    });
  });
}

async function updateModerationTarget(db, userId, target, options) {
  const updateOptions = {
    blocked: options?.blocked === true,
    reason: options?.blocked ? options?.reason || null : null,
    actor: options?.actor || null,
    until: options?.blocked ? options?.until || null : null,
    at: options?.at || Date.now()
  };

  const ok = target === 'posting'
    ? await updatePostingBlockAsync(db, userId, updateOptions)
    : await updateAccountBlockAsync(db, userId, updateOptions);

  if (!ok) {
    throw apiError.notFound('not_found');
  }

  return getUserRowById(db, userId);
}

async function resolveOpenModerationAppeals(db, userId, target, status, reviewer, resolutionMessage) {
  const openAppeals = await listOpenUserModerationAppeals(db, userId, target);
  if (!openAppeals.length) {
    return [];
  }

  const resolvedAt = Date.now();
  return Promise.all(openAppeals.map((appeal) =>
    updateModerationAppealResolution(
      db,
      appeal.id,
      status,
      resolvedAt,
      resolutionMessage || null,
      reviewer || null
    )
  ));
}

async function forwardAutoResolvedModerationAppeals(appeals, actor, logger) {
  const safeAppeals = Array.isArray(appeals) ? appeals.filter(Boolean) : [];
  if (!safeAppeals.length) {
    return;
  }

  await Promise.all(safeAppeals.map((appeal) => forwardPlatformUserAudit({
    entityType: 'platform_user',
    entityId: String(appeal.userId || '').trim(),
    action: 'platform_user_appeal_auto_accept',
    actor: actor || 'admin',
    at: Number(appeal.resolvedAt || Date.now()),
    details: {
      appealId: appeal.id,
      target: appeal.target,
      status: appeal.status,
      resolutionMessage: appeal.resolutionMessage || null,
      reviewer: appeal.reviewer || actor || null,
      trigger: 'moderator_unblock'
    }
  }, logger)));
}

router.get('/internal/moderation/appeals/open',
  [
    security.checkToken
  ],
  async function (req, res, next) {
    const rawLimit = Number(req.query?.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 500) : 100;

    try {
      const response = await buildOpenUserModerationAppealsResponse(req.database.db, limit);
      return res.status(200).json({ status: 200, ...response });
    } catch {
      return next(apiError.internal('db_error'));
    }
  });

router.get('/internal/moderation/:userId',
  [
    security.checkToken
  ],
  async function (req, res, next) {
    const userId = String(req.params.userId || '').trim();
    if (!isUuid(userId)) {
      return next(apiError.badRequest('invalid_user_id'));
    }

    tableUser.getById(req.database.db, userId, async (err, row) => {
      if (err) {
        return next(apiError.internal('db_error'));
      }
      if (!row) {
        return next(apiError.notFound('not_found'));
      }
      try {
        const response = await buildUserModerationResponse(req.database.db, row);
        return res.status(200).json({ status: 200, ...response });
      } catch {
        return next(apiError.internal('db_error'));
      }
    });
  });

router.patch('/internal/moderation/:userId/posting',
  [
    security.checkToken,
    express.json({ type: 'application/json' })
  ],
  async function (req, res, next) {
    const userId = String(req.params.userId || '').trim();
    if (!isUuid(userId)) {
      return next(apiError.badRequest('invalid_user_id'));
    }

    const blocked = req.body?.blocked === true || req.body?.blocked === 1 || req.body?.blocked === '1';
    const reason = blocked ? normalizeModerationReason(req.body?.reason, 'posting') : null;
    const actor = normalizeOptionalText(req.body?.actor, 200);
    const rawBlockedUntil = req.body?.blockedUntil;
    const until = blocked ? normalizeBlockUntil(req.body?.blockedUntil) : null;

    if (blocked && !reason) {
      return next(apiError.badRequest('invalid_reason'));
    }
    if (blocked && hasBlockUntilValue(rawBlockedUntil) && until === null) {
      return next(apiError.badRequest('invalid_blocked_until'));
    }
    if (blocked && until !== null && until < Date.now()) {
      return next(apiError.badRequest('blocked_until_in_past'));
    }

    try {
      let resolvedAppeals = [];
      await updateModerationTarget(req.database.db, userId, 'posting', {
        blocked,
        reason,
        actor,
        until,
        at: Date.now()
      });
      if (!blocked) {
        resolvedAppeals = await resolveOpenModerationAppeals(
          req.database.db,
          userId,
          tableUserModerationAppeal.appealTarget.POSTING,
          tableUserModerationAppeal.appealStatus.ACCEPTED,
          actor,
          'Resolved through moderator unblock.'
        );
        void forwardAutoResolvedModerationAppeals(resolvedAppeals, actor, req.logger);
      }
      const row = await getUserRowById(req.database.db, userId);
      const response = await buildUserModerationResponse(req.database.db, row);
      return res.status(200).json({ status: 200, ...response });
    } catch (error) {
      return next(error?.status ? error : apiError.internal('db_error'));
    }
  });

router.patch('/internal/moderation/:userId/account',
  [
    security.checkToken,
    express.json({ type: 'application/json' })
  ],
  async function (req, res, next) {
    const userId = String(req.params.userId || '').trim();
    if (!isUuid(userId)) {
      return next(apiError.badRequest('invalid_user_id'));
    }

    const blocked = req.body?.blocked === true || req.body?.blocked === 1 || req.body?.blocked === '1';
    const reason = blocked ? normalizeModerationReason(req.body?.reason, 'account') : null;
    const actor = normalizeOptionalText(req.body?.actor, 200);
    const rawBlockedUntil = req.body?.blockedUntil;
    const until = blocked ? normalizeBlockUntil(req.body?.blockedUntil) : null;

    if (blocked && !reason) {
      return next(apiError.badRequest('invalid_reason'));
    }
    if (blocked && hasBlockUntilValue(rawBlockedUntil) && until === null) {
      return next(apiError.badRequest('invalid_blocked_until'));
    }
    if (blocked && until !== null && until < Date.now()) {
      return next(apiError.badRequest('blocked_until_in_past'));
    }

    try {
      let resolvedAppeals = [];
      await updateModerationTarget(req.database.db, userId, 'account', {
        blocked,
        reason,
        actor,
        until,
        at: Date.now()
      });
      if (!blocked) {
        resolvedAppeals = await resolveOpenModerationAppeals(
          req.database.db,
          userId,
          tableUserModerationAppeal.appealTarget.ACCOUNT,
          tableUserModerationAppeal.appealStatus.ACCEPTED,
          actor,
          'Resolved through moderator unblock.'
        );
        void forwardAutoResolvedModerationAppeals(resolvedAppeals, actor, req.logger);
      }
      const row = await getUserRowById(req.database.db, userId);
      const response = await buildUserModerationResponse(req.database.db, row);
      return res.status(200).json({ status: 200, ...response });
    } catch (error) {
      return next(error?.status ? error : apiError.internal('db_error'));
    }
  });

router.patch('/internal/moderation/appeals/:appealId',
  [
    security.checkToken,
    express.json({ type: 'application/json' })
  ],
  async function (req, res, next) {
    const appealId = String(req.params.appealId || '').trim();
    if (!isUuid(appealId)) {
      return next(apiError.badRequest('invalid_appeal_id'));
    }

    const status = normalizeAppealStatus(req.body?.status);
    const reviewer = normalizeOptionalText(req.body?.reviewer, 200);
    const resolutionMessage = normalizeOptionalText(req.body?.resolutionMessage, 2000);

    if (!status) {
      return next(apiError.badRequest('invalid_status'));
    }

    try {
      const appeal = await getModerationAppealById(req.database.db, appealId);
      if (!appeal) {
        return next(apiError.notFound('not_found'));
      }
      if (appeal.status !== tableUserModerationAppeal.appealStatus.OPEN) {
        return next(apiError.conflict('appeal_already_resolved'));
      }

      if (status === tableUserModerationAppeal.appealStatus.ACCEPTED) {
        await updateModerationTarget(req.database.db, appeal.userId, appeal.target, {
          blocked: false,
          reason: null,
          actor: reviewer,
          until: null,
          at: Date.now()
        });
      }

      const resolvedAppeal = await updateModerationAppealResolution(
        req.database.db,
        appealId,
        status,
        Date.now(),
        resolutionMessage,
        reviewer
      );
      const row = await getUserRowById(req.database.db, appeal.userId);
      const response = await buildUserModerationResponse(req.database.db, row);
      return res.status(200).json({
        status: 200,
        appeal: resolvedAppeal,
        ...response
      });
    } catch (error) {
      return next(error?.status ? error : apiError.internal('db_error'));
    }
  });

function sanitizeRestoreContacts(rawContacts, userId) {
  const rows = normalizeRows(rawContacts);
  if (rows.length > MAX_RESTORE_CONTACT_ROWS) {
    throw createInvalidBackupError();
  }

  const contacts = [];
  const relatedUsers = new Map();
  const seenContactIds = new Set();

  rows.forEach((row) => {
    if (!row || String(row.userId ?? '') !== userId) {
      return;
    }
    const contactId = String(row.id ?? '').trim();
    const contactUserId = String(row.contactUserId ?? '').trim();
    if (!isUuid(contactId) || !isUuid(contactUserId) || contactUserId === userId || seenContactIds.has(contactId)) {
      return;
    }

    const signingPublicKey = normalizePublicKeyValue(row.contactUserSigningPublicKey);
    const encryptionPublicKey = normalizePublicKeyValue(row.contactUserEncryptionPublicKey);
    if (!signingPublicKey || !encryptionPublicKey) {
      return;
    }

    seenContactIds.add(contactId);
    contacts.push({
      id: contactId,
      userId,
      contactUserId,
      contactUserSigningPublicKey: signingPublicKey,
      contactUserEncryptionPublicKey: encryptionPublicKey,
      subscribed: normalizeSubscribed(row.subscribed),
      hint: normalizeText(row.hint, 4096),
      name: normalizeOptionalText(row.name, 65535),
      lastMessageFrom: normalizeText(row.lastMessageFrom, 32),
      lastMessageAt: normalizeTimestamp(row.lastMessageAt)
    });

    if (!relatedUsers.has(contactUserId)) {
      relatedUsers.set(contactUserId, {
        id: contactUserId,
        cryptoPublicKey: encryptionPublicKey,
        signingPublicKey,
        numberOfMessages: 0,
        numberOfBlockedMessages: 0,
        userStatus: tableUser.userStatus.ENABLED,
        lastSignOfLife: Math.floor(Date.now() / 1000),
        subscription: '',
        type: 'user'
      });
    }
  });

  return { contacts, relatedUsers };
}

function sanitizeRestorePlaces(rawPlaces, userId) {
  const rows = normalizeRows(rawPlaces);
  if (rows.length > MAX_RESTORE_PLACE_ROWS) {
    throw createInvalidBackupError();
  }

  const places = [];
  const seenPlaceIds = new Set();
  rows.forEach((row) => {
    if (!row || String(row.userId ?? '') !== userId) {
      return;
    }
    const placeId = String(row.id ?? '').trim();
    if (!isUuid(placeId) || seenPlaceIds.has(placeId)) {
      return;
    }
    const latMin = Number(row.latMin);
    const latMax = Number(row.latMax);
    const lonMin = Number(row.lonMin);
    const lonMax = Number(row.lonMax);
    const inRange = Number.isFinite(latMin)
      && Number.isFinite(latMax)
      && Number.isFinite(lonMin)
      && Number.isFinite(lonMax)
      && latMin >= -90 && latMax <= 90
      && lonMin >= -180 && lonMax <= 180
      && latMin <= latMax
      && lonMin <= lonMax;
    if (!inRange) {
      return;
    }
    const placeName = normalizeOptionalText(row.name, 65535);
    if (!placeName) {
      return;
    }

    seenPlaceIds.add(placeId);
    places.push({
      id: placeId,
      userId,
      name: placeName,
      subscribed: normalizeSubscribed(row.subscribed),
      latMin,
      latMax,
      lonMin,
      lonMax
    });
  });

  return places;
}

function sanitizeRestoreUsageProtection(rawRows, userId) {
  const rows = normalizeRows(rawRows);
  if (!rows.length) {
    return [];
  }
  const ownRow = rows.find((row) => row && String(row.userId ?? '') === userId);
  if (!ownRow) {
    return [];
  }
  const settings = parseJsonObject(ownRow.settings);
  const state = parseJsonObject(ownRow.state);
  if (!settings || !state) {
    return [];
  }
  return [{
    userId,
    settings: JSON.stringify(settings),
    state: JSON.stringify(state)
  }];
}

function sanitizeBackupForRestore(backup) {
  const userId = String(backup?.userId ?? '').trim();
  if (!isUuid(userId)) {
    throw createInvalidBackupError();
  }
  const tables = backup?.tables && typeof backup.tables === 'object' ? backup.tables : {};
  const { contacts, relatedUsers } = sanitizeRestoreContacts(tables.tableContact, userId);
  const places = sanitizeRestorePlaces(tables.tablePlace, userId);
  const usageProtection = sanitizeRestoreUsageProtection(tables.tableUsageProtection, userId);

  const rawUserRows = normalizeRows(tables.tableUser);
  const ownUserRowRaw = rawUserRows.find((row) => row && String(row.id ?? '') === userId) || {};
  const ownUserRow = {
    id: userId,
    cryptoPublicKey: normalizePublicKeyValue(ownUserRowRaw.cryptoPublicKey),
    signingPublicKey: normalizePublicKeyValue(ownUserRowRaw.signingPublicKey),
    numberOfMessages: 0,
    numberOfBlockedMessages: 0,
    userStatus: tableUser.userStatus.ENABLED,
    lastSignOfLife: Math.floor(Date.now() / 1000),
    subscription: normalizeText(ownUserRowRaw.subscription, 20000),
    type: normalizeOwnUserType(ownUserRowRaw.type)
  };

  const userRows = [ownUserRow, ...Array.from(relatedUsers.values())];
  if (userRows.length > MAX_RESTORE_USER_ROWS) {
    throw createInvalidBackupError();
  }

  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    userId,
    tables: {
      tableUser: userRows,
      tableMessage: [],
      tableContact: contacts,
      tableContactMessage: [],
      tablePlace: places,
      tableNotification: [],
      tableLike: [],
      tableDislike: [],
      tableConnect: [],
      tableUsageProtection: usageProtection
    }
  };
}

async function insertRows(db, tableName, columns, rows) {
  const safeRows = normalizeRows(rows);
  if (!safeRows.length) {
    return;
  }

  const placeholders = columns.map(() => '?').join(', ');
  const sql = `INSERT OR IGNORE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders});`;

  for (const row of safeRows) {
    const values = columns.map((column) => (row && row[column] !== undefined ? row[column] : null));
    await runQuery(db, sql, values);
  }
}

async function restoreUserBackup(db, backup) {
  const tables = backup?.tables || {};

  const userColumns = [
    'id',
    'cryptoPublicKey',
    'signingPublicKey',
    'numberOfMessages',
    'numberOfBlockedMessages',
    'userStatus',
    'lastSignOfLife',
    'subscription',
    'type'
  ];

  const messageColumns = [
    'id',
    'uuid',
    'parentUuid',
    'typ',
    'createDateTime',
    'deleteDateTime',
    'latitude',
    'longitude',
    'plusCode',
    'message',
    'markerType',
    'style',
    'views',
    'likes',
    'dislikes',
    'commentsNumber',
    'status',
    'userId',
    'multimedia',
    'dsaStatusToken',
    'dsaStatusTokenCreatedAt'
  ];

  const contactColumns = [
    'id',
    'userId',
    'contactUserId',
    'contactUserSigningPublicKey',
    'contactUserEncryptionPublicKey',
    'subscribed',
    'hint',
    'name',
    'lastMessageFrom',
    'lastMessageAt'
  ];

  const contactMessageColumns = [
    'id',
    'messageId',
    'contactId',
    'direction',
    'message',
    'signature',
    'translatedMessage',
    'status',
    'createdAt',
    'readAt',
    'reaction'
  ];

  const placeColumns = [
    'id',
    'userId',
    'name',
    'subscribed',
    'latMin',
    'latMax',
    'lonMin',
    'lonMax'
  ];

  const notificationColumns = [
    'id',
    'uuid',
    'userId',
    'title',
    'body',
    'category',
    'source',
    'status',
    'metadata',
    'createdAt',
    'readAt'
  ];

  const connectColumns = [
    'id',
    'userId',
    'hint',
    'signature',
    'encryptionPublicKey',
    'signingPublicKey',
    'timeOfCreation'
  ];

  const usageProtectionColumns = [
    'userId',
    'settings',
    'state'
  ];

  const likeColumns = ['likeMessageUuid', 'likeUserId'];
  const dislikeColumns = ['dislikeMessageUuid', 'dislikeUserId'];

  await runQuery(db, 'BEGIN IMMEDIATE');

  try {
    await insertRows(db, 'tableUser', userColumns, tables.tableUser);

    const allMessages = normalizeRows(tables.tableMessage);
    const parentMessages = allMessages.filter((row) => !row?.parentUuid);
    const childMessages = allMessages.filter((row) => row?.parentUuid);

    await insertRows(db, 'tableMessage', messageColumns, parentMessages);
    for (const row of childMessages) {
      if (!row?.parentUuid) {
        continue;
      }
      const parentExists = await queryGet(db, 'SELECT 1 FROM tableMessage WHERE uuid = ? LIMIT 1;', [row.parentUuid]);
      if (!parentExists) {
        continue;
      }
      await insertRows(db, 'tableMessage', messageColumns, [row]);
    }

    const contacts = normalizeRows(tables.tableContact);
    for (const row of contacts) {
      if (!row?.contactUserId) {
        continue;
      }
      const contactUserExists = await queryGet(db, 'SELECT 1 FROM tableUser WHERE id = ? LIMIT 1;', [row.contactUserId]);
      if (!contactUserExists) {
        continue;
      }
      await insertRows(db, 'tableContact', contactColumns, [row]);
    }
    await insertRows(db, 'tablePlace', placeColumns, tables.tablePlace);
    await insertRows(db, 'tableNotification', notificationColumns, tables.tableNotification);
    await insertRows(db, 'tableConnect', connectColumns, tables.tableConnect);
    await insertRows(db, 'tableUsageProtection', usageProtectionColumns, tables.tableUsageProtection);

    const contactMessages = normalizeRows(tables.tableContactMessage);
    for (const row of contactMessages) {
      if (!row?.contactId) {
        continue;
      }
      const contactExists = await queryGet(db, 'SELECT 1 FROM tableContact WHERE id = ? LIMIT 1;', [row.contactId]);
      if (!contactExists) {
        continue;
      }
      await insertRows(db, 'tableContactMessage', contactMessageColumns, [row]);
    }

    const likeRows = normalizeRows(tables.tableLike);
    for (const row of likeRows) {
      if (!row?.likeMessageUuid) {
        continue;
      }
      const messageExists = await queryGet(db, 'SELECT 1 FROM tableMessage WHERE uuid = ? LIMIT 1;', [row.likeMessageUuid]);
      if (!messageExists) {
        continue;
      }
      await insertRows(db, 'tableLike', likeColumns, [row]);
    }

    const dislikeRows = normalizeRows(tables.tableDislike);
    for (const row of dislikeRows) {
      if (!row?.dislikeMessageUuid) {
        continue;
      }
      const messageExists = await queryGet(db, 'SELECT 1 FROM tableMessage WHERE uuid = ? LIMIT 1;', [row.dislikeMessageUuid]);
      if (!messageExists) {
        continue;
      }
      await insertRows(db, 'tableDislike', dislikeColumns, [row]);
    }

    await runQuery(db, 'COMMIT');
  } catch (err) {
    await runQuery(db, 'ROLLBACK');
    throw err;
  }
}

const loginChallenges = new Map();
const moderationAccessChallenges = new Map();
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function issueChallenge(challengeStore, userId) {
  const challenge = crypto.randomBytes(32).toString('base64url');
  challengeStore.set(String(userId), {
    challenge,
    expiresAt: Date.now() + CHALLENGE_TTL_MS
  });
  return challenge;
}

function validateChallenge(challengeStore, userId, challenge) {
  const key = String(userId);
  const entry = challengeStore.get(key);
  if (!entry) {
    return false;
  }
  if (Date.now() > entry.expiresAt) {
    challengeStore.delete(key);
    return false;
  }
  const matches = entry.challenge === challenge;
  if (matches) {
    challengeStore.delete(key);
  }
  return matches;
}

function issueLoginChallenge(userId) {
  return issueChallenge(loginChallenges, userId);
}

function validateLoginChallenge(userId, challenge) {
  return validateChallenge(loginChallenges, userId, challenge);
}

function issueModerationAccessChallenge(userId) {
  return issueChallenge(moderationAccessChallenges, userId);
}

function validateModerationAccessChallenge(userId, challenge) {
  return validateChallenge(moderationAccessChallenges, userId, challenge);
}

async function verifySignedChallenge(signingPublicKey, challenge, signature) {
  const payloadBuffer = Buffer.from(challenge);
  let signatureBuffer;
  try {
    signatureBuffer = Buffer.from(JSON.parse(signature));
  } catch {
    return false;
  }
  const publicKey = await subtle.importKey(
    'jwk',
    signingPublicKey,
    { name: 'ECDSA', namedCurve: 'P-384' },
    true,
    ['verify']
  );
  return await subtle.verify(
    { name: 'ECDSA', hash: 'SHA-384' },
    publicKey,
    signatureBuffer,
    payloadBuffer
  );
}

async function verifyModerationAccessRequest(db, payload) {
  const userId = String(payload?.userId || '').trim();
  const challenge = String(payload?.challenge || '').trim();
  const signature = payload?.signature;

  if (!userId || !challenge || !signature) {
    throw apiError.badRequest('invalid_request');
  }

  const row = await queryGet(db, `
    SELECT *
    FROM tableUser
    WHERE id = ?;
  `, [userId]);

  if (!row) {
    throw apiError.notFound('not_found');
  }

  if (!row.signingPublicKey) {
    throw apiError.conflict('missing_public_key');
  }

  if (!validateModerationAccessChallenge(userId, challenge)) {
    throw apiError.unauthorized('unauthorized');
  }

  let signingPublicKey;
  try {
    signingPublicKey = JSON.parse(row.signingPublicKey);
  } catch {
    throw apiError.internal('invalid_public_key');
  }

  let verified = false;
  try {
    verified = await verifySignedChallenge(signingPublicKey, challenge, signature);
  } catch {
    throw apiError.internal('signature_failed');
  }

  if (!verified) {
    throw apiError.unauthorized('unauthorized');
  }

  return row;
}

const rateLimitDefaults = {
  standardHeaders: true,
  legacyHeaders: false
};

const rateLimitMessage = (message) => ({
  errorCode: 'RATE_LIMIT',
  message,
  error: message
});

const userCreateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many user create requests, please try again later.')
});

const userConfirmLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many user auth requests, please try again later.')
});

router.get('/get/:userId',
  [
    security.authenticate
  ],
  function (req, res, next) {
  if (!ensureSameUser(req, res, req.params.userId, next)) {
    return;
  }
  tableUser.getById(req.database.db, req.params.userId, function (err, row) {
    if (err) {
      return next(apiError.internal('db_error'));
    }
    if (!row) {
      return next(apiError.notFound('not_found'));
    }
    res.status(200).json({ status: 200, rawUser: row });
  });
});

router.get('/moderation/:userId',
  [
    security.authenticate
  ],
  async function (req, res, next) {
    const userId = String(req.params.userId || '').trim();
    if (!ensureSameUser(req, res, userId, next)) {
      return;
    }

    try {
      const row = await getUserRowById(req.database.db, userId);
      if (!row) {
        return next(apiError.notFound('not_found'));
      }
      const response = await buildUserModerationResponse(req.database.db, row);
      return res.status(200).json({ status: 200, ...response });
    } catch {
      return next(apiError.internal('db_error'));
    }
  });

router.get('/backup/:userId',
  [
    security.authenticate
  ],
  async function (req, res, next) {
    if (!ensureSameUser(req, res, req.params.userId, next)) {
      return;
    }

    try {
      const backup = await buildUserBackup(req.database.db, req.params.userId);
      res.status(200).json({ status: 200, backup });
    } catch {
      next(apiError.internal('backup_failed'));
    }
  });

router.post('/restore',
  [
    security.authenticate,
    express.json({ type: 'application/json', limit: '20mb' })
  ],
  async function (req, res, next) {
    const backup = req.body?.backup;
    if (!backup || !backup.tables || !backup.userId) {
      return next(apiError.badRequest('invalid_backup'));
    }
    if (!ensureSameUser(req, res, backup.userId, next)) {
      return;
    }

    try {
      const sanitizedBackup = sanitizeBackupForRestore(backup);
      await restoreUserBackup(req.database.db, sanitizedBackup);
      res.status(200).json({ status: 200 });
    } catch (err) {
      if (err?.code === 'INVALID_BACKUP') {
        return next(apiError.badRequest('invalid_backup'));
      }
      next(apiError.internal('restore_failed'));
    }
  });

router.get('/usage-protection/:userId',
  [
    security.authenticate
  ],
  function (req, res, next) {
    const userId = req.params.userId;
    if (!ensureSameUser(req, res, userId, next)) {
      return;
    }

    tableUsageProtection.getByUserId(req.database.db, userId, (err, row) => {
      if (err) {
        return next(apiError.internal('db_error'));
      }
      if (!row) {
        return res.status(200).json({ status: 200, usageProtection: null });
      }

      const settings = parseJsonObject(row.settings);
      const state = parseJsonObject(row.state);
      if (!settings || !state) {
        return res.status(200).json({ status: 200, usageProtection: null });
      }
      return res.status(200).json({
        status: 200,
        usageProtection: {
          settings,
          state
        }
      });
    });
  });

router.post('/usage-protection/:userId',
  [
    security.authenticate,
    express.json({ type: 'application/json', limit: '200kb' })
  ],
  function (req, res, next) {
    const userId = req.params.userId;
    if (!ensureSameUser(req, res, userId, next)) {
      return;
    }

    const usageProtection = normalizeUsageProtectionPayload(req.body);
    if (!usageProtection) {
      return next(apiError.badRequest('invalid_request'));
    }

    let settingsJson;
    let stateJson;
    try {
      settingsJson = JSON.stringify(usageProtection.settings);
      stateJson = JSON.stringify(usageProtection.state);
    } catch {
      return next(apiError.badRequest('invalid_request'));
    }

    tableUsageProtection.upsert(req.database.db, userId, settingsJson, stateJson, (err) => {
      if (err) {
        return next(apiError.internal('db_error'));
      }
      return res.status(200).json({ status: 200 });
    });
  });

router.post('/hashpin',
  [
    express.json({ type: 'application/json' })
  ]
  , async function (req, res, next) {
    const pin = await cryptoUtil.decrypt(getEncryptionPrivateKey(), JSON.parse(req.body.pin));

    if (!pin || typeof pin !== 'string' || pin.length !== 6) {
      return next(apiError.badRequest('invalid_pin'));
    }

    try {
      crypto.scrypt(pin, process.env.PIN_SALT, 64, (err, derivedKey) => {
        if (err) {
          return next(apiError.internal('hashing_failed'));
        }

        return res.status(200).json({ status: 200, pinHash: derivedKey.toString('hex') });
      });
    } catch {
      return next(apiError.internal('hashing_failed'));
    }

  });

router.post('/create',
  [
    userCreateLimit,
    express.json({ type: 'application/json' }),
    metric.count('user.create', { when: 'always', timezone: 'utc', amount: 1 })
  ]
  , function (req, res, next) {
    const userId = crypto.randomUUID();

    tableUser.create(req.database.db, userId, function (err) {
      if (err) {
        return next(apiError.internal('db_error'));
      }
      res.status(200).json({
        status: 200,
        userId
      });
    });
  });

router.post('/register',
  [
    userConfirmLimit,
    express.json({ type: 'application/json' }),
    metric.count('user.register', { when: 'always', timezone: 'utc', amount: 1 })
  ]
  , function (req, res, next) {
    const { userId, signingPublicKey, cryptoPublicKey } = req.body ?? {};

    if (!userId || !signingPublicKey || !cryptoPublicKey) {
      return next(apiError.badRequest('invalid_request'));
    }

    tableUser.getById(req.database.db, userId, function (err, row) {
      if (err) {
        return next(apiError.internal('db_error'));
      }

      const signingKeyValue = typeof signingPublicKey === 'string'
        ? signingPublicKey
        : JSON.stringify(signingPublicKey);
      const cryptoKeyValue = typeof cryptoPublicKey === 'string'
        ? cryptoPublicKey
        : JSON.stringify(cryptoPublicKey);

      const updateKeys = () => {
        tableUser.updatePublicKeys(req.database.db, userId, signingKeyValue, cryptoKeyValue, function (updateErr) {
          if (updateErr) {
            return next(apiError.internal('db_error'));
          }
          res.status(200).json({ status: 200 });
        });
      };

      if (!row) {
        return tableUser.create(req.database.db, userId, function (createErr) {
          if (createErr) {
            return next(apiError.internal('db_error'));
          }
          updateKeys();
        });
      }

      if (row.signingPublicKey || row.cryptoPublicKey) {
        return next(apiError.conflict('already_registered'));
      }

      return updateKeys();
    });
  });

router.post('/reset-keys',
  [
    security.authenticate,
    userConfirmLimit,
    express.json({ type: 'application/json' }),
    metric.count('user.resetKeys', { when: 'always', timezone: 'utc', amount: 1 })
  ]
  , async function (req, res, next) {
    const { userId, signingPublicKey, cryptoPublicKey } = req.body ?? {};

    if (!userId || !signingPublicKey || !cryptoPublicKey) {
      return next(apiError.badRequest('invalid_request'));
    }
    if (!ensureSameUser(req, res, userId, next)) {
      return;
    }

    const signingKeyValue = typeof signingPublicKey === 'string'
      ? signingPublicKey
      : JSON.stringify(signingPublicKey);
    const cryptoKeyValue = typeof cryptoPublicKey === 'string'
      ? cryptoPublicKey
      : JSON.stringify(cryptoPublicKey);

    try {
      const userRow = await queryGet(req.database.db, 'SELECT id FROM tableUser WHERE id = ?;', [userId]);
      if (!userRow) {
        return next(apiError.notFound('not_found'));
      }

      const contactRows = await queryAll(
        req.database.db,
        'SELECT DISTINCT userId FROM tableContact WHERE contactUserId = ?;',
        [userId]
      );
      const contactUserIds = contactRows.map((row) => row.userId).filter(Boolean);

      await runQuery(req.database.db, 'BEGIN IMMEDIATE');
      await runQuery(
        req.database.db,
        'UPDATE tableUser SET signingPublicKey = ?, cryptoPublicKey = ? WHERE id = ?;',
        [signingKeyValue, cryptoKeyValue, userId]
      );
      await runQuery(
        req.database.db,
        'UPDATE tableContact SET contactUserSigningPublicKey = ?, contactUserEncryptionPublicKey = ? WHERE contactUserId = ?;',
        [signingKeyValue, cryptoKeyValue, userId]
      );
      await runQuery(
        req.database.db,
        "DELETE FROM tableContactMessage WHERE contactId IN (SELECT id FROM tableContact WHERE userId = ?) AND direction = 'user';",
        [userId]
      );
      await runQuery(
        req.database.db,
        `
        UPDATE tableContact
        SET lastMessageFrom = COALESCE((
          SELECT direction
          FROM tableContactMessage cm
          WHERE cm.contactId = tableContact.id
          ORDER BY cm.createdAt DESC
          LIMIT 1
        ), ''),
        lastMessageAt = (
          SELECT createdAt
          FROM tableContactMessage cm
          WHERE cm.contactId = tableContact.id
          ORDER BY cm.createdAt DESC
          LIMIT 1
        )
        WHERE userId = ?;
        `,
        [userId]
      );
      await runQuery(req.database.db, 'DELETE FROM tableConnect WHERE userId = ?;', [userId]);
      await runQuery(req.database.db, 'COMMIT');

      emitKeyUpdate(contactUserIds, {
        status: 200,
        type: 'contact_keys_updated',
        content: {
          userId,
          signingPublicKey: signingKeyValue,
          cryptoPublicKey: cryptoKeyValue
        }
      });
      emitKeyUpdate([userId], {
        status: 200,
        type: 'security_reset',
        content: {
          userId
        }
      });

      res.status(200).json({ status: 200 });
    } catch {
      try {
        await runQuery(req.database.db, 'ROLLBACK');
      } catch {
        // ignore rollback errors
      }
      return next(apiError.internal('reset_keys_failed'));
    }
  });

router.post('/challenge',
  [
    userConfirmLimit,
    express.json({ type: 'application/json' }),
    metric.count('user.challenge', { when: 'always', timezone: 'utc', amount: 1 })
  ]
  , async function (req, res, next) {
    const { userId } = req.body ?? {};
    if (!userId) {
      return next(apiError.badRequest('invalid_request'));
    }

    try {
      const row = await queryGet(req.database.db, `
        SELECT signingPublicKey, userStatus, accountBlockedUntil
        FROM tableUser
        WHERE id = ?;
      `, [userId]);
      if (!row) {
        return next(apiError.notFound('not_found'));
      }
      if (isAccountBlockedRow(row)) {
        return next(apiError.forbidden('user_account_blocked'));
      }
      if (!row.signingPublicKey) {
        return next(apiError.conflict('missing_public_key'));
      }

      const challenge = issueLoginChallenge(userId);
      res.status(200).json({ status: 200, challenge });
    } catch {
      return next(apiError.internal('db_error'));
    }
  });

router.post('/login',
  [
    userConfirmLimit,
    express.json({ type: 'application/json' }),
    metric.count('user.login', { when: 'always', timezone: 'utc', amount: 1 })
  ]
  , async function (req, res, next) {
    const secret = process.env.JWT_SECRET;
    const { userId, challenge, signature } = req.body ?? {};

    if (!userId || !challenge || !signature) {
      return next(apiError.badRequest('invalid_request'));
    }

    try {
      const row = await queryGet(req.database.db, `
        SELECT signingPublicKey, userStatus, accountBlockedUntil
        FROM tableUser
        WHERE id = ?;
      `, [userId]);
      if (!row) {
        return next(apiError.notFound('not_found'));
      }
      if (isAccountBlockedRow(row)) {
        return next(apiError.forbidden('user_account_blocked'));
      }
      if (!row.signingPublicKey) {
        return next(apiError.conflict('missing_public_key'));
      }
      if (!validateLoginChallenge(userId, challenge)) {
        return next(apiError.unauthorized('unauthorized'));
      }

      let signingPublicKey;
      try {
        signingPublicKey = JSON.parse(row.signingPublicKey);
      } catch {
        return next(apiError.internal('invalid_public_key'));
      }

      let verified = false;
      try {
        verified = await verifySignedChallenge(signingPublicKey, challenge, signature);
      } catch (err) {
        req.logger?.error('user signature verification failed', { error: err?.message });
        return next(apiError.internal('signature_failed'));
      }

      if (!verified) {
        return next(apiError.unauthorized('unauthorized'));
      }

      await runQuery(req.database.db, `UPDATE tableUser SET lastSignOfLife = strftime('%s','now') WHERE id = ?;`, [userId]);

      const token = jwt.sign(
        { userId },
        secret,
        { expiresIn: '1h' }
      );

      res.status(200).json({ status: 200, jwt: token });
    } catch {
      return next(apiError.internal('db_error'));
    }
  });

router.post('/moderation/challenge',
  [
    userConfirmLimit,
    express.json({ type: 'application/json' })
  ],
  async function (req, res, next) {
    const userId = String(req.body?.userId || '').trim();
    if (!isUuid(userId)) {
      return next(apiError.badRequest('invalid_user_id'));
    }

    try {
      const row = await queryGet(req.database.db, `
        SELECT signingPublicKey
        FROM tableUser
        WHERE id = ?;
      `, [userId]);
      if (!row) {
        return next(apiError.notFound('not_found'));
      }
      if (!row.signingPublicKey) {
        return next(apiError.conflict('missing_public_key'));
      }

      const challenge = issueModerationAccessChallenge(userId);
      return res.status(200).json({ status: 200, challenge });
    } catch {
      return next(apiError.internal('db_error'));
    }
  });

router.post('/moderation/status',
  [
    userConfirmLimit,
    express.json({ type: 'application/json' })
  ],
  async function (req, res, next) {
    try {
      const row = await verifyModerationAccessRequest(req.database.db, req.body);
      const response = await buildUserModerationResponse(req.database.db, row);
      return res.status(200).json({ status: 200, ...response });
    } catch (error) {
      return next(error?.status ? error : apiError.internal('db_error'));
    }
  });

router.post('/moderation/appeal',
  [
    userConfirmLimit,
    express.json({ type: 'application/json' })
  ],
  async function (req, res, next) {
    const target = normalizeAppealTarget(req.body?.target);
    const message = normalizeAppealMessage(req.body?.message, 4000);
    if (!target) {
      return next(apiError.badRequest('invalid_target'));
    }
    if (!message) {
      return next(apiError.badRequest('appeal_message_required'));
    }

    try {
      const row = await verifyModerationAccessRequest(req.database.db, req.body);
      const moderation = moderationPayloadFromUser(row);
      if (!isModerationTargetBlocked(moderation, target)) {
        return next(apiError.conflict('appeal_target_not_blocked'));
      }

      const openAppeals = await listOpenUserModerationAppeals(req.database.db, row.id, target);
      if (openAppeals.length > 0) {
        return next(apiError.conflict('appeal_already_open'));
      }

      const appeal = await createModerationAppeal(req.database.db, {
        id: crypto.randomUUID(),
        userId: row.id,
        target,
        status: tableUserModerationAppeal.appealStatus.OPEN,
        message,
        createdAt: Date.now(),
        resolvedAt: null,
        resolutionMessage: null,
        reviewer: null
      });
      const response = await buildUserModerationResponse(req.database.db, row);
      void forwardPlatformUserAudit({
        entityType: 'platform_user',
        entityId: row.id,
        action: 'platform_user_appeal_create',
        actor: row.id,
        at: Number(appeal.createdAt || Date.now()),
        details: {
          appealId: appeal.id,
          target: appeal.target,
          status: appeal.status,
          message: appeal.message,
          createdAt: appeal.createdAt
        }
      }, req.logger);
      return res.status(201).json({
        status: 201,
        appeal,
        ...response
      });
    } catch (error) {
      return next(error?.status ? error : apiError.internal('db_error'));
    }
  });

router.get('/delete/:userId',
  [
    security.authenticate,
    metric.count('user.delete', { when: 'always', timezone: 'utc', amount: 1 })
  ]
  , function (req, res, next) {
    if (!ensureSameUser(req, res, req.params.userId, next)) {
      return;
    }
    tableUser.deleteById(req.database.db, req.params.userId, function (err) {
      if (err) {
        return next(apiError.internal('db_error'));
      }
      res.status(200).json({ status: 200 });
    });
  });

router.get('/renewjwt',
  [
    security.authenticate
  ]
  , (req, res, next) => {
    const secret = process.env.JWT_SECRET;
    const userId = req.jwtUser?.userId ?? req.jwtUser?.id;
    if (!userId) {
      return next(apiError.unauthorized('unauthorized'));
    }
    const token = jwt.sign(
      { userId },
      secret,
      { expiresIn: '1h' }
    );

    res.json({ status: 200, token });
  });

router.post('/subscribe',
  [
    security.authenticate,
    express.json({ type: 'application/json' })
  ]
  , function (req, res, next) {
    if (!ensureSameUser(req, res, req.body.userId, next)) {
      return;
    }
    tableUser.subscribe(req.database.db, req.body.userId, req.body.subscription, function (err) {
      if (err) {
        return next(apiError.internal('db_error'));
      }
      res.status(200).json({ status: 200 });
    });
  });

router.get('/unsubscribe/:userId',
  [
    security.authenticate
  ]
  , function (req, res, next) {
    if (!ensureSameUser(req, res, req.params.userId, next)) {
      return;
    }
    tableUser.unsubscribe(req.database.db, req.params.userId, function (err) {
      if (err) {
        return next(apiError.internal('db_error'));
      }
      res.status(200).json({ status: 200 });
    });
  });


module.exports = router
