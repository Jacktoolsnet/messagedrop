const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const security = require('../middleware/security');
const tableSecretDrop = require('../db/tableSecretDrop');
const metric = require('../middleware/metric');
const { apiError } = require('../middleware/api-error');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_HINT_LENGTH = 512;
const MAX_HINT_STYLE_LENGTH = 4096;
const MAX_PLUS_CODE_LENGTH = 32;
const MAX_ENCRYPTED_PAYLOAD_LENGTH = 32768;
const MAX_CRYPTO_METADATA_LENGTH = 8192;
const MAX_AUTH_VERIFIER_LENGTH = 4096;
const MAX_RECIPIENTS = 50;
const DEFAULT_DISCOVERY_ZOOM_LEVEL = 18;
const MIN_DISCOVERY_ZOOM_LEVEL = 12;
const MAX_DISCOVERY_ZOOM_LEVEL = 19;
const MAX_VALIDITY_WINDOW_SECONDS = 30 * 24 * 60 * 60;

const unlockLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 429, error: 'too_many_secret_drop_unlock_attempts' }
});


function pickRowValue(row, ...keys) {
  for (const key of keys) {
    if (row && row[key] !== undefined) {
      return row[key];
    }
  }
  return undefined;
}

function getAuthUserId(req) {
  return req.jwtUser?.userId ?? req.jwtUser?.id ?? null;
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function normalizeString(value, maxLength = 1024) {
  const normalized = String(value ?? '').trim();
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function isValidCoordinate(latitude, longitude) {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
}

function normalizePlusCode(value) {
  const plusCode = normalizeString(value, MAX_PLUS_CODE_LENGTH).toUpperCase();
  return plusCode || null;
}

function serializeJsonField(value, fieldName, maxLength) {
  if (value === undefined || value === null) {
    throw apiError.badRequest(`missing_${fieldName}`);
  }
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  if (!serialized || serialized.length > maxLength) {
    throw apiError.badRequest(`invalid_${fieldName}`);
  }
  return serialized;
}

function hashAuthVerifier(authVerifier) {
  return crypto.createHash('sha256').update(String(authVerifier), 'utf8').digest('hex');
}

function normalizeAuthVerifier(value) {
  const authVerifier = normalizeString(value, MAX_AUTH_VERIFIER_LENGTH);
  if (authVerifier.length < 16 || authVerifier.length > MAX_AUTH_VERIFIER_LENGTH) {
    throw apiError.badRequest('invalid_auth_verifier');
  }
  return authVerifier;
}

function normalizeOptionalTimestamp(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) {
    throw apiError.badRequest(`invalid_${fieldName}`);
  }
  return numeric;
}

function normalizeValidityWindow(validFrom, validUntil, at = nowSeconds()) {
  const effectiveStart = validFrom ?? at;
  const effectiveUntil = validUntil ?? (validFrom !== null ? validFrom + MAX_VALIDITY_WINDOW_SECONDS : null);
  if (effectiveUntil !== null && validFrom !== null && validFrom > effectiveUntil) {
    throw apiError.badRequest('invalid_validity_window');
  }
  if (effectiveUntil !== null && effectiveUntil - effectiveStart > MAX_VALIDITY_WINDOW_SECONDS) {
    throw apiError.badRequest('secret_drop_validity_window_too_long');
  }
  return {
    validFrom,
    validUntil: effectiveUntil
  };
}


function normalizeDiscoveryZoomLevel(value, required = false) {
  if (value === undefined || value === null || value === '') {
    return required ? DEFAULT_DISCOVERY_ZOOM_LEVEL : null;
  }
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < MIN_DISCOVERY_ZOOM_LEVEL || numeric > MAX_DISCOVERY_ZOOM_LEVEL) {
    throw apiError.badRequest('invalid_discovery_zoom_level');
  }
  return numeric;
}

function normalizeMaxUnlocks(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 1000000) {
    throw apiError.badRequest('invalid_max_unlocks');
  }
  return numeric;
}

function normalizeVisibility(value) {
  const visibility = normalizeString(value || 'public', 32).toLowerCase();
  if (!['public', 'contacts'].includes(visibility)) {
    throw apiError.badRequest('invalid_secret_drop_visibility');
  }
  return visibility;
}

function normalizeCreatorMode(value) {
  const creatorMode = normalizeString(value || 'normal', 32).toLowerCase();
  if (!['normal', 'incognito'].includes(creatorMode)) {
    throw apiError.badRequest('invalid_secret_drop_creator_mode');
  }
  return creatorMode;
}

function normalizeRecipientUserIds(value) {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw apiError.badRequest('invalid_secret_drop_recipients');
  }
  const ids = [...new Set(value.map((id) => normalizeString(id, 128)).filter(Boolean))];
  if (ids.length > MAX_RECIPIENTS) {
    throw apiError.badRequest('too_many_secret_drop_recipients');
  }
  return ids;
}

async function normalizeAndValidateRecipients(db, ownerUserId, visibility, rawRecipientUserIds) {
  if (visibility !== 'contacts') {
    return [];
  }
  const recipientUserIds = normalizeRecipientUserIds(rawRecipientUserIds);
  if (recipientUserIds.length === 0) {
    throw apiError.badRequest('secret_drop_recipients_required');
  }
  const validRecipientUserIds = await tableSecretDrop.getValidContactRecipientUserIds(db, ownerUserId, recipientUserIds);
  if (validRecipientUserIds.length !== recipientUserIds.length) {
    throw apiError.badRequest('invalid_secret_drop_recipients');
  }
  return validRecipientUserIds;
}

function ensureNoPlainSecretFields(body) {
  const forbiddenFields = ['message', 'secret', 'secretMessage', 'plaintext', 'plainText', 'password'];
  const present = forbiddenFields.find((field) => Object.prototype.hasOwnProperty.call(body || {}, field));
  if (present) {
    throw apiError.badRequest(`plaintext_field_not_allowed_${present}`);
  }
}

function mapPublicSecretDrop(drop) {
  const creatorMode = drop.creatorMode === 'incognito' ? 'incognito' : 'normal';
  const mapped = {
    uuid: drop.uuid,
    latitude: drop.latitude,
    longitude: drop.longitude,
    plusCode: drop.plusCode,
    discoveryPlusCode: drop.discoveryPlusCode,
    discoveryZoomLevel: drop.discoveryZoomLevel ?? DEFAULT_DISCOVERY_ZOOM_LEVEL,
    hint: drop.hint,
    hintStyle: drop.hintStyle || '',
    maxUnlocks: drop.maxUnlocks,
    unlockCount: drop.unlockCount,
    validFrom: drop.validFrom,
    validUntil: drop.validUntil,
    status: drop.status,
    likes: drop.likes,
    dislikes: drop.dislikes,
    commentsNumber: drop.commentsNumber,
    visibility: drop.visibility || 'public',
    creatorMode,
    recipientUserIds: Array.isArray(drop.recipientUserIds) ? drop.recipientUserIds : [],
    createdAt: drop.createdAt
  };
  if (creatorMode !== 'incognito') {
    mapped.userId = drop.userId;
  }
  if (drop.crypto) {
    mapped.crypto = drop.crypto;
  }
  return mapped;
}

function getDb(req) {
  return req.database?.db;
}

function getUserById(db, userId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM tableUser WHERE id = ? LIMIT 1;', [userId], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

async function ensureExistingUser(db, userId) {
  const user = await getUserById(db, userId);
  if (!user) {
    throw apiError.notFound('user_not_found');
  }
}

async function ensureOwnerOrUnlocked(db, uuid, userId) {
  const drop = await tableSecretDrop.getByUuid(db, uuid);
  if (!drop || drop.status === tableSecretDrop.secretDropStatus.DELETED) {
    throw apiError.notFound('secret_drop_not_found');
  }
  if (String(drop.userId) === String(userId)) {
    return drop;
  }
  const unlocked = await tableSecretDrop.hasSuccessfulUnlock(db, uuid, userId);
  if (!unlocked) {
    throw apiError.forbidden('secret_drop_unlock_required');
  }
  return drop;
}


function mapInternalSecretDrop(drop) {
  return {
    ...mapPublicSecretDrop(drop),
    userId: drop.userId,
    status: drop.status,
    dsaStatusToken: drop.dsaStatusToken ?? null,
    dsaStatusTokenCreatedAt: drop.dsaStatusTokenCreatedAt ?? null,
    updatedAt: drop.updatedAt ?? null,
    lastUnlockedAt: drop.lastUnlockedAt ?? null,
    consumedAt: drop.consumedAt ?? null
  };
}

async function sendInternalSecretDropByUuid(req, res, next) {
  try {
    const uuid = normalizeString(req.params.uuid, 64);
    if (!UUID_REGEX.test(uuid)) {
      throw apiError.badRequest('invalid_secret_drop_uuid');
    }
    const drop = await tableSecretDrop.getByUuid(getDb(req), uuid);
    if (!drop || drop.status === tableSecretDrop.secretDropStatus.DELETED) {
      throw apiError.notFound('secret_drop_not_found');
    }
    res.status(200).json({ status: 200, secretDrop: mapInternalSecretDrop(drop) });
  } catch (error) {
    next(error);
  }
}

router.post('/create', [
  security.authenticate,
  express.json({ type: 'application/json', limit: '80kb' }),
  metric.count('secretdrop.create', { when: 'always', timezone: 'utc', amount: 1 })
], async (req, res, next) => {
  try {
    const db = getDb(req);
    const authUserId = getAuthUserId(req);
    const userId = normalizeString(req.body?.userId || req.body?.messageUserId, 128);
    if (!authUserId || String(authUserId) !== String(userId)) {
      throw apiError.forbidden('forbidden');
    }
    await ensureExistingUser(db, userId);
    ensureNoPlainSecretFields(req.body);

    const latitude = Number(req.body?.latitude);
    const longitude = Number(req.body?.longitude);
    if (!isValidCoordinate(latitude, longitude)) {
      throw apiError.badRequest('invalid_location');
    }

    const plusCode = normalizePlusCode(req.body?.plusCode);
    const discoveryPlusCode = normalizePlusCode(req.body?.discoveryPlusCode || req.body?.plusCode);
    if (!plusCode || !discoveryPlusCode) {
      throw apiError.badRequest('invalid_plus_code');
    }

    const encryptedPayload = serializeJsonField(
      req.body?.encryptedPayload ?? req.body?.ciphertext,
      'encrypted_payload',
      MAX_ENCRYPTED_PAYLOAD_LENGTH
    );
    const cryptoMetadata = serializeJsonField(req.body?.crypto, 'crypto', MAX_CRYPTO_METADATA_LENGTH);
    const authVerifier = normalizeAuthVerifier(req.body?.authVerifier);
    const discoveryZoomLevel = normalizeDiscoveryZoomLevel(req.body?.discoveryZoomLevel, true);
    const maxUnlocks = normalizeMaxUnlocks(req.body?.maxUnlocks);
    const validFrom = normalizeOptionalTimestamp(req.body?.validFrom, 'valid_from');
    const validUntil = normalizeOptionalTimestamp(req.body?.validUntil, 'valid_until');
    const validityWindow = normalizeValidityWindow(validFrom, validUntil);
    const publishState = normalizeString(req.body?.publishState, 32);
    const status = publishState === 'draft' || publishState === 'unpublished'
      ? tableSecretDrop.secretDropStatus.DISABLED
      : tableSecretDrop.secretDropStatus.ENABLED;
    const visibility = normalizeVisibility(req.body?.visibility);
    const creatorMode = normalizeCreatorMode(req.body?.creatorMode);
    const recipientUserIds = await normalizeAndValidateRecipients(db, userId, visibility, req.body?.recipientUserIds);

    const drop = await tableSecretDrop.create(db, {
      uuid: crypto.randomUUID(),
      userId,
      latitude,
      longitude,
      plusCode,
      discoveryPlusCode,
      discoveryZoomLevel,
      hint: normalizeString(req.body?.hint, MAX_HINT_LENGTH),
      hintStyle: normalizeString(req.body?.hintStyle, MAX_HINT_STYLE_LENGTH),
      encryptedPayload,
      crypto: cryptoMetadata,
      authVerifierHash: hashAuthVerifier(authVerifier),
      maxUnlocks,
      validFrom: validityWindow.validFrom,
      validUntil: validityWindow.validUntil,
      status,
      visibility,
      creatorMode,
      recipientUserIds
    });

    res.status(201).json({ status: 201, secretDrop: mapPublicSecretDrop(drop) });
  } catch (error) {
    next(error);
  }
});


router.post('/republish/:uuid', [
  security.authenticate,
  express.json({ type: 'application/json', limit: '80kb' }),
  metric.count('secretdrop.republish', { when: 'always', timezone: 'utc', amount: 1 })
], async (req, res, next) => {
  try {
    const uuid = normalizeString(req.params.uuid, 64);
    if (!UUID_REGEX.test(uuid)) {
      throw apiError.badRequest('invalid_secret_drop_uuid');
    }
    const db = getDb(req);
    const authUserId = getAuthUserId(req);
    const userId = normalizeString(req.body?.userId || req.body?.messageUserId, 128);
    if (!authUserId || String(authUserId) !== String(userId)) {
      throw apiError.forbidden('forbidden');
    }
    await ensureExistingUser(db, userId);
    ensureNoPlainSecretFields(req.body);

    const latitude = Number(req.body?.latitude);
    const longitude = Number(req.body?.longitude);
    if (!isValidCoordinate(latitude, longitude)) {
      throw apiError.badRequest('invalid_location');
    }

    const plusCode = normalizePlusCode(req.body?.plusCode);
    const discoveryPlusCode = normalizePlusCode(req.body?.discoveryPlusCode || req.body?.plusCode);
    if (!plusCode || !discoveryPlusCode) {
      throw apiError.badRequest('invalid_plus_code');
    }

    const encryptedPayload = serializeJsonField(
      req.body?.encryptedPayload ?? req.body?.ciphertext,
      'encrypted_payload',
      MAX_ENCRYPTED_PAYLOAD_LENGTH
    );
    const cryptoMetadata = serializeJsonField(req.body?.crypto, 'crypto', MAX_CRYPTO_METADATA_LENGTH);
    const authVerifier = normalizeAuthVerifier(req.body?.authVerifier);
    const discoveryZoomLevel = normalizeDiscoveryZoomLevel(req.body?.discoveryZoomLevel, true);
    const maxUnlocks = normalizeMaxUnlocks(req.body?.maxUnlocks);
    const validFrom = normalizeOptionalTimestamp(req.body?.validFrom, 'valid_from');
    const validUntil = normalizeOptionalTimestamp(req.body?.validUntil, 'valid_until');
    const validityWindow = normalizeValidityWindow(validFrom, validUntil);
    const visibility = normalizeVisibility(req.body?.visibility);
    const creatorMode = normalizeCreatorMode(req.body?.creatorMode);
    const recipientUserIds = await normalizeAndValidateRecipients(db, userId, visibility, req.body?.recipientUserIds);

    const drop = await tableSecretDrop.updateContent(db, uuid, userId, {
      latitude,
      longitude,
      plusCode,
      discoveryPlusCode,
      discoveryZoomLevel,
      hint: normalizeString(req.body?.hint, MAX_HINT_LENGTH),
      hintStyle: normalizeString(req.body?.hintStyle, MAX_HINT_STYLE_LENGTH),
      encryptedPayload,
      crypto: cryptoMetadata,
      authVerifierHash: hashAuthVerifier(authVerifier),
      maxUnlocks,
      validFrom: validityWindow.validFrom,
      validUntil: validityWindow.validUntil,
      status: tableSecretDrop.secretDropStatus.ENABLED,
      visibility,
      creatorMode,
      recipientUserIds
    });
    if (!drop) {
      throw apiError.notFound('secret_drop_not_found');
    }

    res.status(200).json({ status: 200, secretDrop: mapPublicSecretDrop(drop) });
  } catch (error) {
    next(error);
  }
});

router.get('/discover/pluscode/:plusCode', security.authenticateOptional, async (req, res, next) => {
  try {
    const plusCode = normalizePlusCode(req.params.plusCode);
    if (!plusCode) {
      throw apiError.badRequest('invalid_plus_code');
    }
    const zoomLevel = normalizeDiscoveryZoomLevel(req.query?.zoomLevel ?? req.query?.zoom, false);
    const rows = await tableSecretDrop.discoverByPlusCode(getDb(req), plusCode, nowSeconds(), zoomLevel, getAuthUserId(req));
    res.status(200).json({ status: 200, rows: rows.map(mapPublicSecretDrop) });
  } catch (error) {
    next(error);
  }
});

router.post('/unlock/:uuid', [
  security.authenticateOptional,
  unlockLimiter,
  express.json({ type: 'application/json', limit: '16kb' }),
  metric.count('secretdrop.unlock', { when: 'always', timezone: 'utc', amount: 1 })
], async (req, res, next) => {
  try {
    const uuid = normalizeString(req.params.uuid, 64);
    if (!UUID_REGEX.test(uuid)) {
      throw apiError.badRequest('invalid_secret_drop_uuid');
    }
    const db = getDb(req);
    const userId = getAuthUserId(req);
    const raw = await tableSecretDrop.getRawByUuid(db, uuid);
    if (!raw || raw.status === tableSecretDrop.secretDropStatus.DELETED) {
      throw apiError.notFound('secret_drop_not_found');
    }

    const at = nowSeconds();
    if (raw.status !== tableSecretDrop.secretDropStatus.ENABLED) {
      throw apiError.conflict('secret_drop_not_available');
    }
    const validFrom = pickRowValue(raw, 'validFrom', 'validfrom');
    const validUntil = pickRowValue(raw, 'validUntil', 'validuntil');
    const maxUnlocks = pickRowValue(raw, 'maxUnlocks', 'maxunlocks');
    const unlockCount = pickRowValue(raw, 'unlockCount', 'unlockcount');
    const storedAuthVerifierHash = pickRowValue(raw, 'authVerifierHash', 'authverifierhash');

    if ((validFrom !== null && validFrom !== undefined && Number(validFrom) > at)
      || (validUntil !== null && validUntil !== undefined && Number(validUntil) < at)) {
      throw apiError.conflict('secret_drop_not_in_validity_window');
    }
    if (maxUnlocks !== null && maxUnlocks !== undefined && Number(unlockCount || 0) >= Number(maxUnlocks)) {
      throw apiError.conflict('secret_drop_consumed');
    }

    const authVerifier = normalizeAuthVerifier(req.body?.authVerifier);
    const authVerifierHash = hashAuthVerifier(authVerifier);
    if (authVerifierHash !== storedAuthVerifierHash) {
      await tableSecretDrop.recordFailedUnlock(db, uuid, userId || null);
      throw apiError.forbidden('invalid_secret_drop_password');
    }

    const unlocked = await tableSecretDrop.unlock(db, uuid, authVerifierHash, userId || null, at);
    if (!unlocked) {
      throw apiError.conflict('secret_drop_not_available');
    }

    res.status(200).json({
      status: 200,
      secretDrop: {
        ...mapPublicSecretDrop(unlocked),
        encryptedPayload: unlocked.encryptedPayload,
        crypto: unlocked.crypto
      }
    });
  } catch (error) {
    next(error);
  }
});


router.get('/internal/uuid/:uuid', security.checkToken, sendInternalSecretDropByUuid);

router.get('/my/:userId', security.authenticate, async (req, res, next) => {
  try {
    const authUserId = getAuthUserId(req);
    const userId = normalizeString(req.params.userId, 128);
    if (!authUserId || String(authUserId) !== String(userId)) {
      throw apiError.forbidden('forbidden');
    }
    const rows = await tableSecretDrop.getByUserId(getDb(req), userId);
    res.status(200).json({ status: 200, rows: rows.map(mapPublicSecretDrop) });
  } catch (error) {
    next(error);
  }
});

router.get('/stats/:uuid', security.authenticate, async (req, res, next) => {
  try {
    const authUserId = getAuthUserId(req);
    const uuid = normalizeString(req.params.uuid, 64);
    if (!UUID_REGEX.test(uuid)) {
      throw apiError.badRequest('invalid_secret_drop_uuid');
    }
    const drop = await tableSecretDrop.getByUuid(getDb(req), uuid);
    if (!drop || drop.status === tableSecretDrop.secretDropStatus.DELETED) {
      throw apiError.notFound('secret_drop_not_found');
    }
    if (String(drop.userId) !== String(authUserId)) {
      throw apiError.forbidden('forbidden');
    }
    res.status(200).json({
      status: 200,
      secretDrop: mapPublicSecretDrop(drop),
      stats: {
        unlockCount: drop.unlockCount,
        failedUnlockCount: drop.failedUnlockCount,
        lastUnlockedAt: drop.lastUnlockedAt,
        consumedAt: drop.consumedAt,
        likes: drop.likes,
        dislikes: drop.dislikes,
        commentsNumber: drop.commentsNumber
      }
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/delete/:uuid', security.authenticate, async (req, res, next) => {
  try {
    const authUserId = getAuthUserId(req);
    const uuid = normalizeString(req.params.uuid, 64);
    if (!UUID_REGEX.test(uuid)) {
      throw apiError.badRequest('invalid_secret_drop_uuid');
    }
    const deleted = await tableSecretDrop.softDelete(getDb(req), uuid, authUserId);
    if (!deleted) {
      throw apiError.notFound('secret_drop_not_found');
    }
    res.status(200).json({ status: 200, deleted: true, uuid });
  } catch (error) {
    next(error);
  }
});

async function updateOwnerStatus(req, res, next, status) {
  try {
    const authUserId = getAuthUserId(req);
    const uuid = normalizeString(req.params.uuid, 64);
    if (!UUID_REGEX.test(uuid)) {
      throw apiError.badRequest('invalid_secret_drop_uuid');
    }
    const drop = await tableSecretDrop.updateStatus(getDb(req), uuid, authUserId, status);
    if (!drop) {
      throw apiError.notFound('secret_drop_not_found');
    }
    res.status(200).json({ status: 200, secretDrop: mapPublicSecretDrop(drop) });
  } catch (error) {
    next(error);
  }
}

router.post('/publish/:uuid', security.authenticate, (req, res, next) =>
  updateOwnerStatus(req, res, next, tableSecretDrop.secretDropStatus.ENABLED)
);

router.post('/unpublish/:uuid', security.authenticate, (req, res, next) =>
  updateOwnerStatus(req, res, next, tableSecretDrop.secretDropStatus.DISABLED)
);

async function handleReaction(req, res, next, reaction) {
  try {
    const uuid = normalizeString(req.params.uuid, 64);
    if (!UUID_REGEX.test(uuid)) {
      throw apiError.badRequest('invalid_secret_drop_uuid');
    }
    const userId = getAuthUserId(req);
    await ensureOwnerOrUnlocked(getDb(req), uuid, userId);
    const state = await tableSecretDrop.toggleReaction(getDb(req), uuid, userId, reaction);
    res.status(200).json({ status: 200, uuid, ...state });
  } catch (error) {
    next(error);
  }
}

router.post('/:uuid/like', [
  security.authenticate,
  express.json({ type: 'application/json', limit: '4kb' })
], (req, res, next) => handleReaction(req, res, next, 'like'));

router.post('/:uuid/dislike', [
  security.authenticate,
  express.json({ type: 'application/json', limit: '4kb' })
], (req, res, next) => handleReaction(req, res, next, 'dislike'));

router.get('/:uuid/reactions', security.authenticateOptional, async (req, res, next) => {
  try {
    const uuid = normalizeString(req.params.uuid, 64);
    if (!UUID_REGEX.test(uuid)) {
      throw apiError.badRequest('invalid_secret_drop_uuid');
    }
    const userId = getAuthUserId(req);
    const drop = await tableSecretDrop.getByUuid(getDb(req), uuid);
    if (!drop || drop.status === tableSecretDrop.secretDropStatus.DELETED) {
      throw apiError.notFound('secret_drop_not_found');
    }
    if (userId) {
      await ensureOwnerOrUnlocked(getDb(req), uuid, userId);
    }
    const state = await tableSecretDrop.getReactionState(getDb(req), uuid, userId);
    res.status(200).json({ status: 200, uuid, ...state });
  } catch (error) {
    next(error);
  }
});

router.post('/:uuid/comments', [
  security.authenticate,
  express.json({ type: 'application/json', limit: '32kb' })
], async (req, res, next) => {
  try {
    const uuid = normalizeString(req.params.uuid, 64);
    if (!UUID_REGEX.test(uuid)) {
      throw apiError.badRequest('invalid_secret_drop_uuid');
    }
    const userId = getAuthUserId(req);
    await ensureOwnerOrUnlocked(getDb(req), uuid, userId);
    ensureNoPlainSecretFields(req.body);
    const encryptedPayload = serializeJsonField(
      req.body?.encryptedPayload ?? req.body?.ciphertext,
      'encrypted_payload',
      MAX_ENCRYPTED_PAYLOAD_LENGTH
    );
    const cryptoMetadata = req.body?.crypto === undefined || req.body?.crypto === null
      ? null
      : serializeJsonField(req.body.crypto, 'crypto', MAX_CRYPTO_METADATA_LENGTH);
    const parentCommentUuid = normalizeString(req.body?.parentCommentUuid, 64);
    if (parentCommentUuid && !UUID_REGEX.test(parentCommentUuid)) {
      throw apiError.badRequest('invalid_secret_drop_comment_uuid');
    }
    const comment = await tableSecretDrop.createComment(getDb(req), {
      uuid: crypto.randomUUID(),
      secretDropUuid: uuid,
      userId,
      encryptedPayload,
      crypto: cryptoMetadata,
      parentCommentUuid: parentCommentUuid || null
    });
    res.status(201).json({ status: 201, comment });
  } catch (error) {
    next(error);
  }
});


router.put('/:uuid/comments/:commentUuid', [
  security.authenticate,
  express.json({ type: 'application/json', limit: '32kb' })
], async (req, res, next) => {
  try {
    const uuid = normalizeString(req.params.uuid, 64);
    const commentUuid = normalizeString(req.params.commentUuid, 64);
    if (!UUID_REGEX.test(uuid) || !UUID_REGEX.test(commentUuid)) {
      throw apiError.badRequest('invalid_secret_drop_comment_uuid');
    }
    const userId = getAuthUserId(req);
    await ensureOwnerOrUnlocked(getDb(req), uuid, userId);
    ensureNoPlainSecretFields(req.body);
    const encryptedPayload = serializeJsonField(
      req.body?.encryptedPayload ?? req.body?.ciphertext,
      'encrypted_payload',
      MAX_ENCRYPTED_PAYLOAD_LENGTH
    );
    const cryptoMetadata = req.body?.crypto === undefined || req.body?.crypto === null
      ? null
      : serializeJsonField(req.body.crypto, 'crypto', MAX_CRYPTO_METADATA_LENGTH);
    const comment = await tableSecretDrop.updateComment(getDb(req), uuid, commentUuid, userId, {
      encryptedPayload,
      crypto: cryptoMetadata
    });
    if (!comment) {
      throw apiError.notFound('secret_drop_comment_not_found');
    }
    res.status(200).json({ status: 200, comment });
  } catch (error) {
    next(error);
  }
});

router.delete('/:uuid/comments/:commentUuid', security.authenticate, async (req, res, next) => {
  try {
    const uuid = normalizeString(req.params.uuid, 64);
    const commentUuid = normalizeString(req.params.commentUuid, 64);
    if (!UUID_REGEX.test(uuid) || !UUID_REGEX.test(commentUuid)) {
      throw apiError.badRequest('invalid_secret_drop_comment_uuid');
    }
    const userId = getAuthUserId(req);
    await ensureOwnerOrUnlocked(getDb(req), uuid, userId);
    const deleted = await tableSecretDrop.deleteComment(getDb(req), uuid, commentUuid, userId);
    if (!deleted) {
      throw apiError.notFound('secret_drop_comment_not_found');
    }
    res.status(200).json({ status: 200, deleted: true, uuid: commentUuid });
  } catch (error) {
    next(error);
  }
});

async function handleCommentReaction(req, res, next, reaction) {
  try {
    const uuid = normalizeString(req.params.uuid, 64);
    const commentUuid = normalizeString(req.params.commentUuid, 64);
    if (!UUID_REGEX.test(uuid) || !UUID_REGEX.test(commentUuid)) {
      throw apiError.badRequest('invalid_secret_drop_comment_uuid');
    }
    const userId = getAuthUserId(req);
    await ensureOwnerOrUnlocked(getDb(req), uuid, userId);
    const comment = await tableSecretDrop.getCommentByUuid(getDb(req), commentUuid);
    if (!comment || comment.secretDropUuid !== uuid) {
      throw apiError.notFound('secret_drop_comment_not_found');
    }
    const state = await tableSecretDrop.toggleCommentReaction(getDb(req), commentUuid, userId, reaction);
    res.status(200).json({ status: 200, uuid: commentUuid, ...state });
  } catch (error) {
    next(error);
  }
}

router.post('/:uuid/comments/:commentUuid/like', [
  security.authenticate,
  express.json({ type: 'application/json', limit: '4kb' })
], (req, res, next) => handleCommentReaction(req, res, next, 'like'));

router.post('/:uuid/comments/:commentUuid/dislike', [
  security.authenticate,
  express.json({ type: 'application/json', limit: '4kb' })
], (req, res, next) => handleCommentReaction(req, res, next, 'dislike'));

router.get('/:uuid/comments', security.authenticate, async (req, res, next) => {
  try {
    const uuid = normalizeString(req.params.uuid, 64);
    if (!UUID_REGEX.test(uuid)) {
      throw apiError.badRequest('invalid_secret_drop_uuid');
    }
    const userId = getAuthUserId(req);
    await ensureOwnerOrUnlocked(getDb(req), uuid, userId);
    const rows = await tableSecretDrop.getComments(getDb(req), uuid);
    res.status(200).json({ status: 200, rows });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
