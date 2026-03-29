const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const security = require('../middleware/security');
const tableMessage = require('../db/tableMessage');
const tableUser = require('../db/tableUser');
const tableLike = require('../db/tableLike');
const tableDislike = require('../db/tableDislike');
const notify = require('../utils/notify');
const metric = require('../middleware/metric');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const OpenAI = require('openai');
const { signServiceJwt } = require('../utils/serviceJwt');
const { apiError } = require('../middleware/api-error');
const { resolveBaseUrl } = require('../utils/adminLogForwarder');
const {
  MAX_PUBLIC_HASHTAGS,
  normalizeHashtags,
  encodeHashtags,
  decodeHashtags,
  formatHashtagsForModeration
} = require('../utils/hashtags');
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function findMessageByIdOrUuid(db, messageId, callback) {
  const raw = String(messageId ?? '');
  const isNumeric = /^\d+$/.test(raw);
  if (isNumeric) {
    return tableMessage.getById(db, raw, callback);
  }
  return tableMessage.getByUuid(db, raw, callback);
}

function normalizeInternalMultimedia(multimedia) {
  if (typeof multimedia === 'string') {
    return sanitizeSingleQuotes(multimedia);
  }
  if (multimedia && typeof multimedia === 'object') {
    return sanitizeSingleQuotes(JSON.stringify(multimedia));
  }
  return '';
}

function updateInternalManagedMessage(db, messageUuid, payload, options, callback) {
  const moderation = options?.moderation || {};
  const aiModeration = moderation?.aiModeration ?? null;
  const aiModerationScore = Number.isFinite(moderation?.aiScore) ? moderation.aiScore : null;
  const aiModerationFlagged = moderation?.aiFlagged === undefined || moderation?.aiFlagged === null
    ? null
    : (moderation.aiFlagged ? 1 : 0);
  const aiModerationDecision = moderation?.aiDecision ?? null;
  const aiModerationAt = Number.isFinite(moderation?.aiCheckedAt) ? moderation.aiCheckedAt : null;
  const patternMatch = moderation?.patternMatch === undefined || moderation?.patternMatch === null
    ? null
    : (moderation.patternMatch ? 1 : 0);
  const patternMatchAt = Number.isFinite(moderation?.patternMatchAt) ? moderation.patternMatchAt : null;
  const nextStatus = options?.status || tableMessage.messageStatus.ENABLED;

  const sql = `
    UPDATE tableMessage
    SET message = ?,
        style = ?,
        multimedia = ?,
        latitude = ?,
        longitude = ?,
        plusCode = UPPER(?),
        markerType = ?,
        hashtags = ?,
        userId = ?,
        status = ?,
        deleteDateTime = strftime('%s','now','+30 days'),
        dsaStatusToken = NULL,
        dsaStatusTokenCreatedAt = NULL,
        aiModeration = ?,
        aiModerationScore = ?,
        aiModerationFlagged = ?,
        aiModerationDecision = ?,
        aiModerationAt = ?,
        patternMatch = ?,
        patternMatchAt = ?,
        manualModerationDecision = NULL,
        manualModerationReason = NULL,
        manualModerationAt = NULL,
        manualModerationBy = NULL
    WHERE uuid = ?;
  `;

  db.run(sql, [
    payload.message,
    payload.style,
    payload.multimedia,
    payload.latitude,
    payload.longitude,
    payload.plusCode,
    payload.markerType,
    payload.hashtags,
    payload.messageUserId,
    nextStatus,
    aiModeration,
    aiModerationScore,
    aiModerationFlagged,
    aiModerationDecision,
    aiModerationAt,
    patternMatch,
    patternMatchAt,
    messageUuid
  ], function (err) {
    callback(err, { affected: this?.changes ?? 0 });
  });
}

// helper
function normalizeLon(lon) {
  const value = Number(lon);
  const normalized = ((value + 180) % 360 + 360) % 360 - 180;
  const epsilon = 1e-9;
  if (Math.abs(normalized + 180) < epsilon && value > 0) {
    return 180;
  }
  return Object.is(normalized, -0) ? 0 : normalized;
}

const sanitizeSingleQuotes = (value) => String(value ?? '').replace(/'/g, "''");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY_MODERATION });
const moderationModel = process.env.OPENAI_MODERATION_MODEL || 'omni-moderation-latest';
const adminAudience = process.env.SERVICE_JWT_AUDIENCE_ADMIN || 'service.admin-backend';

function detectPersonalInformation(text) {
  const commonTlds = new Set([
    'com', 'org', 'net', 'edu', 'gov', 'mil', 'int', 'info', 'biz', 'name', 'pro', 'dev', 'app', 'io',
    'de', 'at', 'ch', 'fr', 'es', 'it', 'pt', 'nl', 'be', 'lu', 'uk', 'ie',
    'us', 'ca', 'au', 'nz', 'jp', 'kr', 'cn', 'in', 'br', 'mx', 'ar', 'cl', 'co',
    'se', 'no', 'dk', 'fi', 'pl', 'cz', 'sk', 'hu', 'ro', 'bg', 'hr', 'si', 'gr', 'tr', 'ru', 'ua'
  ]);
  const containsUuidLikeValue = (value) =>
    /(^|[^0-9a-f])(?:[0-9a-f]{8}[\s\u200B-\u200D\uFEFF._:,;/\\|()\[\]{}#*+=~"'`-]*[0-9a-f]{4}[\s\u200B-\u200D\uFEFF._:,;/\\|()\[\]{}#*+=~"'`-]*[1-8][0-9a-f]{3}[\s\u200B-\u200D\uFEFF._:,;/\\|()\[\]{}#*+=~"'`-]*[89ab][0-9a-f]{3}[\s\u200B-\u200D\uFEFF._:,;/\\|()\[\]{}#*+=~"'`-]*[0-9a-f]{12})([^0-9a-f]|$)/i
      .test(value);
  const normalizedTokenText = String(text ?? '')
    .toLowerCase()
    .replace(/[#]+/g, ' ')
    .replace(/[()[\]{};,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const normalizedObfuscatedText = String(text ?? '')
    .toLowerCase()
    .replace(/[\(\[\{]\s*at\s*[\)\]\}]/g, ' @ ')
    .replace(/\bat\b/g, ' @ ')
    .replace(/[\(\[\{]\s*(dot|punkt)\s*[\)\]\}]/g, ' . ')
    .replace(/\b(dot|punkt)\b/g, ' . ')
    .replace(/[#]+/g, ' ')
    .replace(/[()[\]{};,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const patterns = [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
    /\b[a-z0-9._%+-]+\s*@\s*[a-z0-9-]+(?:\s*\.\s*[a-z0-9-]+)+\b/i,
    /\b(?:\d[ -]*?){13,19}\b/,
    /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}\b/,
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/,
    /\b(?:[a-fA-F0-9:]+:+)+[a-fA-F0-9]+\b/,
    /\b\d{3}-\d{2}-\d{4}\b/,
    /\b(?:https?:\/\/|www\.)[^\s]+/i,
    /\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?/i
  ];

  if (
    containsUuidLikeValue(text)
    || containsUuidLikeValue(normalizedObfuscatedText)
    || patterns.some(pattern => pattern.test(text) || pattern.test(normalizedObfuscatedText))
  ) {
    return true;
  }

  const tokens = normalizedTokenText.split(' ').filter(Boolean);
  const isLocalPart = (value) => /^[a-z0-9._%+-]{2,64}$/i.test(value);
  const isDomainLabel = (value) => /^[a-z0-9-]{2,63}$/i.test(value);
  const isTld = (value) => /^[a-z]{2,24}$/i.test(value) && commonTlds.has(value.toLowerCase());

  for (let index = 1; index < tokens.length - 2; index += 1) {
    const marker = tokens[index];
    if (marker !== '@' && marker !== 'at' && marker !== 'ät') {
      continue;
    }
    const localPart = tokens[index - 1];
    const domain = tokens[index + 1];
    if (!isLocalPart(localPart) || !isDomainLabel(domain)) {
      continue;
    }
    let tldIndex = index + 2;
    if (tokens[tldIndex] === '.' || tokens[tldIndex] === 'dot' || tokens[tldIndex] === 'punkt') {
      tldIndex += 1;
    }
    const tld = tokens[tldIndex];
    if (!tld) {
      continue;
    }
    if (isTld(tld)) {
      return true;
    }
  }

  const phoneCandidates = String(text ?? '').match(/\+?[0-9][0-9()\s.-]{6,}[0-9]/g);
  if (!phoneCandidates) {
    return false;
  }

  const dateLike = /^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})$/;
  return phoneCandidates.some((candidate) => {
    const trimmed = candidate.trim();
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length < 10) {
      return false;
    }
    if (dateLike.test(trimmed)) {
      return false;
    }
    const hasPlus = trimmed.startsWith('+');
    const hasSeparator = /[()\s-]/.test(trimmed);
    const hasOnlyDigitsAndDots = /^[0-9.]+$/.test(trimmed);
    if (hasOnlyDigitsAndDots) {
      const dotCount = (trimmed.match(/\./g) || []).length;
      return dotCount >= 2;
    }
    if (!hasPlus && !hasSeparator) {
      return false;
    }
    return true;
  });
}

function extractModerationScore(moderation) {
  const result = moderation?.results?.[0];
  const scores = result?.category_scores;
  if (scores && typeof scores === 'object') {
    const values = Object.values(scores)
      .map(Number)
      .filter((value) => Number.isFinite(value));
    if (values.length) {
      return Math.max(...values);
    }
  }
  if (typeof result?.flagged === 'boolean') {
    return result.flagged ? 1 : 0;
  }
  return 0;
}

function decideModeration(score, flagged) {
  // If OpenAI already flags the content, reject it deterministically.
  if (flagged === true) return 'rejected';
  if (score > 0.6) return 'rejected';
  if (score >= 0.4) return 'review';
  return 'approved';
}

function parsePublicHashtags(input) {
  const parsed = normalizeHashtags(input, { max: MAX_PUBLIC_HASHTAGS });
  if (parsed.invalidTokens.length > 0 || parsed.overflow > 0) {
    return null;
  }
  return parsed.tags;
}

function normalizeInternalPublishPayload(body) {
  const messageUuid = typeof body?.uuid === 'string' && UUID_REGEX.test(body.uuid.trim())
    ? body.uuid.trim()
    : crypto.randomUUID();
  const messageTyp = String(body?.messageTyp || tableMessage.messageType.PUBLIC).trim().toLowerCase() || tableMessage.messageType.PUBLIC;
  const messageUserId = String(body?.messageUserId || '').trim();
  const hashtags = parsePublicHashtags(body?.hashtags);

  if (!messageUserId) {
    return { error: apiError.badRequest('missing_user_id') };
  }
  if (![
    tableMessage.messageType.PUBLIC,
    tableMessage.messageType.COMMENT
  ].includes(messageTyp)) {
    return { error: apiError.badRequest('invalid_message_type') };
  }
  if (!hashtags) {
    return { error: apiError.badRequest('invalid_hashtags') };
  }

  return {
    value: {
      uuid: messageUuid,
      messageTyp,
      messageUserId,
      latitude: Number.isFinite(Number(body?.latitude)) ? Number(body.latitude) : 0,
      longitude: Number.isFinite(Number(body?.longitude)) ? Number(body.longitude) : 0,
      plusCode: String(body?.plusCode || '').trim(),
      rawMessage: String(body?.message || ''),
      message: sanitizeSingleQuotes(String(body?.message || '')),
      markerType: String(body?.markerType || 'default').trim() || 'default',
      style: typeof body?.style === 'string' ? body.style : '',
      hashtags,
      encodedHashtags: encodeHashtags(hashtags),
      multimedia: normalizeInternalMultimedia(body?.multimedia),
      parentUuid: typeof body?.parentUuid === 'string' && body.parentUuid.trim() ? body.parentUuid.trim() : null
    }
  };
}

function getUserById(db, userId) {
  return new Promise((resolve, reject) => {
    tableUser.getById(db, userId, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function getMessageByUuid(db, messageUuid) {
  return new Promise((resolve, reject) => {
    tableMessage.getByUuid(db, messageUuid, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function isPostingBlocked(userRow) {
  if (!userRow) return false;
  if (String(userRow.userStatus || '').toLowerCase() === tableUser.userStatus.DISABLED) {
    return true;
  }
  const blocked = Number(userRow.postingBlocked) === 1;
  if (!blocked) return false;
  const until = Number(userRow.postingBlockedUntil);
  if (Number.isFinite(until) && until > 0 && until < Date.now()) {
    return false;
  }
  return true;
}

function moderationPublishErrorMessage(reason) {
  if (reason === 'pattern') {
    return 'This content could not be published because public content must not contain private contact details, links or similar personal data.';
  }
  if (reason === 'ai') {
    return 'This content could not be published because it was rejected by automated moderation.';
  }
  return 'This content could not be published because it was rejected by automated moderation.';
}

async function runAutomatedPublicContentModeration(rawMessage, hashtags) {
  const moderationInput = [String(rawMessage ?? ''), formatHashtagsForModeration(hashtags)].filter(Boolean).join(' ').trim();
  const moderation = {};
  let status = tableMessage.messageStatus.ENABLED;
  let moderationDecision = null;
  let moderationScore = null;
  let moderationFlagged = null;
  let moderationReason = null;

  moderation.patternMatch = detectPersonalInformation(moderationInput);
  moderation.patternMatchAt = Date.now();

  if (moderation.patternMatch) {
    moderationScore = null;
    moderationFlagged = true;
    moderationDecision = 'rejected';
    moderationReason = 'pattern';
    status = tableMessage.messageStatus.DISABLED;
  }

  if (!moderation.patternMatch) {
    try {
      const moderationResult = await openai.moderations.create({
        model: moderationModel,
        input: moderationInput
      });
      moderationScore = extractModerationScore(moderationResult);
      moderationFlagged = moderationResult?.results?.[0]?.flagged ?? false;
      moderationDecision = decideModeration(moderationScore, moderationFlagged);
      if (moderationDecision === 'rejected') {
        moderationReason = 'ai';
        status = tableMessage.messageStatus.DISABLED;
      }
      moderation.aiModeration = JSON.stringify(moderationResult);
      moderation.aiScore = moderationScore;
      moderation.aiFlagged = moderationFlagged;
      moderation.aiDecision = moderationDecision;
      moderation.aiCheckedAt = Date.now();
    } catch (err) {
      const apiErr = apiError.internal('openai_failed');
      apiErr.detail = err?.message || err;
      throw apiErr;
    }
  }

  return {
    moderation,
    status,
    moderationDecision,
    moderationScore,
    moderationFlagged,
    moderationReason
  };
}

function isMessageLockedByModeration(messageRow) {
  if (!messageRow) {
    return false;
  }
  if (String(messageRow.status || '').toLowerCase() !== tableMessage.messageStatus.DISABLED) {
    return false;
  }
  if (messageRow.dsaStatusToken) {
    return true;
  }
  return String(messageRow.manualModerationDecision || '').toLowerCase() === 'rejected';
}

function isMessageRejectedByAutomatedModeration(messageRow) {
  if (!messageRow) {
    return false;
  }
  if (String(messageRow.manualModerationDecision || '').toLowerCase() === 'approved') {
    return false;
  }
  if (String(messageRow.aiModerationDecision || '').toLowerCase() === 'rejected') {
    return true;
  }
  return Number(messageRow.patternMatch) === 1 || messageRow.patternMatch === true;
}

async function forwardModerationRequest(payload, logger) {
  const baseUrl = resolveBaseUrl(process.env.ADMIN_BASE_URL, process.env.ADMIN_PORT);
  if (!baseUrl) {
    return { sent: false };
  }
  const url = `${baseUrl}/moderation/requests`;
  try {
    const serviceToken = await signServiceJwt({ audience: adminAudience });
    const resp = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${serviceToken}`,
        'content-type': 'application/json'
      },
      timeout: 5000,
      validateStatus: () => true
    });
    if (resp.status >= 200 && resp.status < 300) {
      return { sent: true, id: resp.data?.id ?? null };
    }
    logger?.warn?.('Moderation request forward failed', { status: resp.status, data: resp.data });
  } catch (err) {
    logger?.warn?.('Moderation request forward failed', { error: err?.message || err });
  }
  return { sent: false };
}

const messageCreateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    errorCode: 'RATE_LIMIT',
    message: 'Too many message create requests, please try again later.',
    error: 'Too many message create requests, please try again later.'
  }
});

router.get('/get', function (req, res, next) {
  tableMessage.getAll(req.database.db, function (err, rows) {
    if (err) {
      return next(apiError.internal('db_error'));
    }
    if (!rows || rows.length === 0) {
      return next(apiError.notFound('not_found'));
    }
    res.status(200).json({ status: 200, rows });
  });
});

router.get('/get/id/:messageId', function (req, res, next) {
  tableMessage.getById(req.database.db, req.params.messageId, function (err, row) {
    if (err) {
      return next(apiError.internal('db_error'));
    }
    if (!row) {
      return next(apiError.notFound('not_found'));
    }
    res.status(200).json({ status: 200, message: row });
  });
});

router.get('/get/uuid/:messageUuid', function (req, res, next) {
  tableMessage.getByUuid(req.database.db, req.params.messageUuid, function (err, row) {
    if (err) {
      return next(apiError.internal('db_error'));
    }
    if (!row) {
      return next(apiError.notFound('not_found'));
    }
    res.status(200).json({ status: 200, message: row });
  });
});

router.get('/get/userId/:userId',
  [
    security.authenticate
  ],
  function (req, res, next) {
  if (!ensureSameUser(req, res, req.params.userId, next)) {
    return;
  }
  tableMessage.getByUserId(req.database.db, req.params.userId, function (err, rows) {
    if (err) {
      return next(apiError.internal('db_error'));
    }
    if (!rows || rows.length === 0) {
      return res.status(200).json({ status: 200, rows: [] });
    }
    res.status(200).json({ status: 200, rows });
  });
});

router.post('/recount-comments/:userId',
  [
    security.authenticate
  ],
  function (req, res, next) {
    if (!ensureSameUser(req, res, req.params.userId, next)) {
      return;
    }
    tableMessage.recountCommentsForUser(req.database.db, req.params.userId, function (err, result) {
      if (err) {
        return next(apiError.internal('db_error'));
      }
      res.status(200).json({ status: 200, updated: result?.updated ?? 0 });
    });
  });

router.get('/get/comment/:parentUuid', function (req, res, next) {
  tableMessage.getByParentUuid(req.database.db, req.params.parentUuid, function (err, rows) {
    if (err) {
      return next(apiError.internal('db_error'));
    }
    res.status(200).json({ status: 200, rows: rows || [] });
  });
});

router.get('/get/hashtag/:tag', function (req, res, next) {
  const tags = parsePublicHashtags([req.params.tag]);
  if (!tags || tags.length === 0) {
    return next(apiError.badRequest('invalid_hashtags'));
  }
  tableMessage.getByHashtag(req.database.db, tags[0], function (err, rows) {
    if (err) {
      return next(apiError.internal('db_error'));
    }
    res.status(200).json({ status: 200, rows: rows || [] });
  });
});

router.get('/get/pluscode/:plusCode', function (req, res, next) {
  let response = { 'status': 0, 'rows': [] };
  // It is not allowed to get all messages with this route.
  if (req.params.plusCode.length < 2 || req.params.plusCode.length > 11) {
    return next(apiError.badRequest('invalid_pluscode'));
  } else {
    if (req.params.plusCode.length > 1 && req.params.plusCode.length < 11) {
      req.params.plusCode = `${req.params.plusCode}%`
    }
    tableMessage.getByPlusCode(req.database.db, req.params.plusCode, function (err, rows) {
      if (err) {
        return next(apiError.internal('db_error'));
      }
      if (!rows || rows.length === 0) {
        return next(apiError.notFound('not_found'));
      }
      rows.forEach((row) => {
        response.rows.push(row);
      });
      response.status = 200;
      res.status(200).json(response);
    });
  }
});

router.get('/get/boundingbox/:latMin/:lonMin/:latMax/:lonMax',
  [
    metric.count('message.search', { when: 'always', timezone: 'utc', amount: 1 })
  ], (req, res, next) => {
    const response = { status: 0, rows: [] };

    // Parse + normalize
    const latMinRaw = parseFloat(req.params.latMin);
    const lonMinRaw = parseFloat(req.params.lonMin);
    const latMaxRaw = parseFloat(req.params.latMax);
    const lonMaxRaw = parseFloat(req.params.lonMax);

    const latMin = latMinRaw;
    const latMax = latMaxRaw;
    const lonMin = normalizeLon(lonMinRaw);
    const lonMax = normalizeLon(lonMaxRaw);

    const isValidLat = (lat) => !isNaN(lat) && lat >= -90 && lat <= 90;
    const isValidLon = (lon) => !isNaN(lon) && lon >= -180 && lon <= 180;

    if (
      !isValidLat(latMin) || !isValidLat(latMax) ||
      !isValidLon(lonMin) || !isValidLon(lonMax) ||
      latMin === latMax || lonMin === lonMax
    ) {
      return next(apiError.badRequest('invalid_bounding_box'));
    }

    tableMessage.getByBoundingBox(
      req.database.db,
      latMin, lonMin, latMax, lonMax,
      (err, rows) => {
        if (err) {
          return next(apiError.internal('db_error'));
        }
        response.rows = rows || [];
        response.status = 200;
        res.status(200).json(response);
      }
    );
  });

router.post('/moderate/hashtags',
  [
    security.authenticate,
    express.json({ type: 'application/json' })
  ],
  async function (req, res, next) {
    const hashtags = parsePublicHashtags(req.body.hashtags);
    if (!hashtags) {
      return next(apiError.badRequest('invalid_hashtags'));
    }

    const moderationInput = formatHashtagsForModeration(hashtags);
    const moderation = {};
    let moderationDecision = 'approved';
    let moderationScore = null;
    let moderationFlagged = null;
    let moderationReason = null;

    moderation.patternMatch = detectPersonalInformation(moderationInput);
    moderation.patternMatchAt = Date.now();

    if (moderation.patternMatch) {
      moderationDecision = 'rejected';
      moderationReason = 'pattern';
      moderationFlagged = true;
    }

    try {
      if (!moderation.patternMatch) {
        const moderationResult = await openai.moderations.create({
          model: moderationModel,
          input: moderationInput
        });
        moderationScore = extractModerationScore(moderationResult);
        moderationFlagged = moderationResult?.results?.[0]?.flagged ?? false;
        moderationDecision = decideModeration(moderationScore, moderationFlagged);
        if (moderationDecision === 'rejected') {
          moderationReason = 'ai';
        }
        moderation.aiModeration = JSON.stringify(moderationResult);
        moderation.aiScore = moderationScore;
        moderation.aiFlagged = moderationFlagged;
        moderation.aiDecision = moderationDecision;
        moderation.aiCheckedAt = Date.now();
      }
    } catch (err) {
      const apiErr = apiError.internal('openai_failed');
      apiErr.detail = err?.message || err;
      return next(apiErr);
    }

    res.status(200).json({
      status: 200,
      moderation: {
        decision: moderationDecision,
        reason: moderationReason,
        score: moderationScore,
        flagged: moderationFlagged,
        patternMatch: moderation.patternMatch ?? null
      }
    });
  });

router.post('/internal/publish',
  [
    security.checkToken,
    express.json({ type: 'application/json' })
  ],
  async function (req, res, next) {
    const normalized = normalizeInternalPublishPayload(req.body);
    if (normalized.error) {
      return next(normalized.error);
    }

    const payload = normalized.value;

    if (payload.messageTyp === tableMessage.messageType.COMMENT && !payload.parentUuid) {
      return next(apiError.badRequest('invalid_parent_uuid'));
    }

    try {
      const userRow = await getUserById(req.database.db, payload.messageUserId);
      if (!userRow) {
        return next(apiError.notFound('user_not_found'));
      }

      if (payload.parentUuid) {
        if (!UUID_REGEX.test(payload.parentUuid)) {
          return next(apiError.badRequest('invalid_parent_uuid'));
        }
        const parentMessage = await getMessageByUuid(req.database.db, payload.parentUuid);
        if (!parentMessage) {
          return next(apiError.notFound('parent_not_found'));
        }
      }

      const requiresModeration = [
        tableMessage.messageType.PUBLIC,
        tableMessage.messageType.COMMENT
      ].includes(payload.messageTyp);
      const moderationResult = requiresModeration
        ? await runAutomatedPublicContentModeration(payload.rawMessage, payload.hashtags)
        : null;

      if (requiresModeration && moderationResult?.moderationDecision === 'rejected') {
        return next(apiError.unprocessableEntity(moderationPublishErrorMessage(moderationResult.moderationReason)));
      }

      const existing = await getMessageByUuid(req.database.db, payload.uuid);
      let messageId = existing?.id ?? null;
      let created = false;
      let updated = false;

      if (existing) {
        const result = await new Promise((resolve, reject) => {
          updateInternalManagedMessage(req.database.db, payload.uuid, payload, {
            moderation: moderationResult?.moderation,
            status: moderationResult?.status || tableMessage.messageStatus.ENABLED
          }, (updateErr, value) => {
            if (updateErr) {
              return reject(updateErr);
            }
            resolve(value || null);
          });
        });
        updated = (result?.affected ?? 0) > 0;
      } else {
        const createResult = await new Promise((resolve, reject) => {
          tableMessage.create(
            req.database.db,
            payload.uuid,
            payload.parentUuid,
            payload.messageTyp,
            payload.latitude,
            payload.longitude,
            payload.plusCode,
            payload.message,
            payload.markerType,
            payload.style,
            payload.messageUserId,
            payload.multimedia,
            {
              status: moderationResult?.status || tableMessage.messageStatus.ENABLED,
              moderation: moderationResult?.moderation,
              hashtags: payload.encodedHashtags
            },
            function (err, result) {
              if (err) {
                return reject(err);
              }
              resolve(result || null);
            }
          );
        });
        messageId = createResult?.id ?? null;
        created = true;
      }

      let moderationRequestSent = false;
      let moderationRequestId = null;
      if (requiresModeration && moderationResult?.moderationDecision === 'review') {
        const moderationPayload = {
          messageId,
          messageUuid: payload.uuid,
          messageUserId: payload.messageUserId,
          messageText: payload.rawMessage,
          messageType: payload.messageTyp,
          messageCreatedAt: Number(existing?.createDateTime) || Date.now(),
          latitude: payload.latitude,
          longitude: payload.longitude,
          plusCode: payload.plusCode,
          markerType: payload.markerType,
          style: payload.style,
          hashtags: payload.hashtags,
          aiScore: moderationResult.moderationScore,
          aiFlagged: moderationResult.moderationFlagged,
          aiDecision: moderationResult.moderationDecision,
          aiResponse: moderationResult.moderation.aiModeration,
          patternMatch: moderationResult.moderation.patternMatch ?? null,
          patternMatchAt: moderationResult.moderation.patternMatchAt ?? null
        };
        const forward = await forwardModerationRequest(moderationPayload, req.logger);
        moderationRequestSent = forward.sent;
        moderationRequestId = forward.id ?? null;
      }

      if (payload.messageTyp === tableMessage.messageType.PUBLIC) {
        notify.placeSubscriptions(
          req.logger,
          req.database.db,
          payload.latitude,
          payload.longitude,
          payload.messageUserId,
          payload.message,
          {
            messageUuid: payload.uuid,
            messagePlusCode: payload.plusCode
          }
        );
      }

      return res.status(200).json({
        status: 200,
        messageId,
        messageUuid: payload.uuid,
        created,
        updated,
        moderation: requiresModeration ? {
          decision: moderationResult?.moderationDecision ?? null,
          reason: moderationResult?.moderationReason ?? null,
          score: moderationResult?.moderationScore ?? null,
          flagged: moderationResult?.moderationFlagged ?? null,
          patternMatch: moderationResult?.moderation?.patternMatch ?? null,
          requestSent: moderationRequestSent,
          requestId: moderationRequestId
        } : null
      });
    } catch (error) {
      return next(error?.status ? error : apiError.internal('db_error'));
    }
  });

router.post('/internal/delete',
  [
    security.checkToken,
    express.json({ type: 'application/json' })
  ],
  function (req, res, next) {
    const messageId = String(req.body?.messageId || '').trim();
    if (!messageId) {
      return next(apiError.badRequest('missing_message_id'));
    }

    findMessageByIdOrUuid(req.database.db, messageId, (lookupErr, row) => {
      if (lookupErr) {
        return next(apiError.internal('db_error'));
      }
      if (!row) {
        return res.status(200).json({ status: 200, deleted: false, notFound: true });
      }

      tableMessage.deleteById(req.database.db, row.id, function (err) {
        if (err) {
          return next(apiError.internal('db_error'));
        }
        return res.status(200).json({ status: 200, deleted: true, messageId: row.id, messageUuid: row.uuid });
      });
    });
  });

router.post('/create',
  [
    messageCreateLimiter,
    security.authenticate,
    express.json({ type: 'application/json' }),
    metric.count('message.create', { when: 'always', timezone: 'utc', amount: 1 })
  ]
  , async function (req, res, next) {
    let response = { 'status': 0 };
    if (!ensureSameUser(req, res, req.body.messageUserId, next)) {
      return;
    }
    let userRow = null;
    try {
      userRow = await getUserById(req.database.db, req.body.messageUserId);
    } catch (error) {
      req.logger?.warn?.('Failed to read user moderation status before message.create', { error: error?.message || error });
      return next(apiError.internal('db_error'));
    }
    if (!userRow) {
      return next(apiError.notFound('user_not_found'));
    }
    if (isPostingBlocked(userRow)) {
      return next(apiError.forbidden('user_blocked_for_posting'));
    }
    const parentUuid = typeof req.body.parentUuid === 'string'
      ? req.body.parentUuid.trim()
      : '';
    if (String(req.body.messageTyp || '').trim().toLowerCase() === tableMessage.messageType.COMMENT && !parentUuid) {
      return next(apiError.badRequest('invalid_parent_uuid'));
    }
    if (parentUuid) {
      if (!UUID_REGEX.test(parentUuid)) {
        return next(apiError.badRequest('invalid_parent_uuid'));
      }
      try {
        const parentMessage = await getMessageByUuid(req.database.db, parentUuid);
        if (!parentMessage) {
          return next(apiError.notFound('parent_not_found'));
        }
        if (String(parentMessage.status || '').trim().toLowerCase() !== tableMessage.messageStatus.ENABLED) {
          return next(apiError.conflict('parent_not_available'));
        }
      } catch (error) {
        req.logger?.warn?.('Failed to read parent message before message.create', { error: error?.message || error });
        return next(apiError.internal('db_error'));
      }
    }
    if (undefined == req.body.parentMessageId) {
      req.body.parentMessageId = 0;
    }
    const rawMessage = String(req.body.message ?? '');
    const sanitizedMessage = sanitizeSingleQuotes(rawMessage);
    const hashtags = parsePublicHashtags(req.body.hashtags);
    if (!hashtags) {
      return next(apiError.badRequest('invalid_hashtags'));
    }
    const encodedHashtags = encodeHashtags(hashtags);
    const moderationInput = [rawMessage, formatHashtagsForModeration(hashtags)].filter(Boolean).join(' ').trim();
    const moderation = {};
    let status = tableMessage.messageStatus.ENABLED;
    let moderationDecision = null;
    let moderationScore = null;
    let moderationFlagged = null;
    let moderationReason = null;
    let moderationRequestSent = false;
    let moderationRequestId = null;

    const requiresModeration = [
      tableMessage.messageType.PUBLIC,
      tableMessage.messageType.COMMENT
    ].includes(req.body.messageTyp);

    if (requiresModeration) {
      const patternMatch = detectPersonalInformation(moderationInput);
      const patternMatchAt = Date.now();
      moderation.patternMatch = patternMatch;
      moderation.patternMatchAt = patternMatchAt;

      if (patternMatch) {
        moderationScore = null;
        moderationFlagged = true;
        moderationDecision = 'rejected';
        moderationReason = 'pattern';
        status = tableMessage.messageStatus.DISABLED;
      }

      try {
        if (!patternMatch) {
          const moderationResult = await openai.moderations.create({
            model: moderationModel,
            input: moderationInput
          });
          moderationScore = extractModerationScore(moderationResult);
          moderationFlagged = moderationResult?.results?.[0]?.flagged ?? false;
          moderationDecision = decideModeration(moderationScore, moderationFlagged);
          if (moderationDecision === 'rejected') {
            moderationReason = 'ai';
          }
          moderation.aiModeration = JSON.stringify(moderationResult);
          moderation.aiScore = moderationScore;
          moderation.aiFlagged = moderationFlagged;
          moderation.aiDecision = moderationDecision;
          moderation.aiCheckedAt = Date.now();
          if (moderationDecision === 'rejected') {
            status = tableMessage.messageStatus.DISABLED;
          }
        }
      } catch (err) {
        const apiErr = apiError.internal('openai_failed');
        apiErr.detail = err?.message || err;
        return next(apiErr);
      }
    }

    const createResult = await new Promise((resolve, reject) => {
      tableMessage.create(
        req.database.db,
        req.body.uuid,
        parentUuid || null,
        req.body.messageTyp,
        req.body.latitude,
        req.body.longitude,
        req.body.plusCode,
        sanitizedMessage,
        req.body.markerType,
        req.body.style,
        req.body.messageUserId,
        sanitizeSingleQuotes(req.body.multimedia),
        { status, moderation, hashtags: encodedHashtags },
        function (err, result) {
          if (err) {
            return reject(err);
          }
          resolve(result || null);
        }
      );
    }).catch((err) => {
      req.logger?.error?.('Message insert failed', { error: err?.message || err });
      return null;
    });

    if (!createResult) {
      return next(apiError.internal('db_error'));
    }

    if (requiresModeration && moderationDecision === 'review') {
      const moderationPayload = {
        messageId: createResult.id ?? null,
        messageUuid: req.body.uuid,
        messageUserId: req.body.messageUserId,
        messageText: rawMessage,
        messageType: req.body.messageTyp,
        messageCreatedAt: Date.now(),
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        plusCode: req.body.plusCode,
        markerType: req.body.markerType,
        style: req.body.style,
        hashtags,
        aiScore: moderationScore,
        aiFlagged: moderationFlagged,
        aiDecision: moderationDecision,
        aiResponse: moderation.aiModeration,
        patternMatch: moderation.patternMatch ?? null,
        patternMatchAt: moderation.patternMatchAt ?? null
      };
      const forward = await forwardModerationRequest(moderationPayload, req.logger);
      moderationRequestSent = forward.sent;
      moderationRequestId = forward.id ?? null;
    }

    if (status === tableMessage.messageStatus.ENABLED) {
      notify.placeSubscriptions(
        req.logger,
        req.database.db,
        req.body.latitude,
        req.body.longitude,
        req.body.messageUserId,
        sanitizedMessage,
        {
          messageUuid: req.body.uuid,
          messagePlusCode: req.body.plusCode
        }
      );
    }

    response.status = 200;
    response.messageId = createResult.id ?? null;
    response.messageUuid = req.body.uuid ?? null;
    response.moderation = requiresModeration ? {
      decision: moderationDecision,
      reason: moderationReason,
      score: moderationScore,
      flagged: moderationFlagged,
      patternMatch: moderation.patternMatch ?? null,
      requestSent: moderationRequestSent,
      requestId: moderationRequestId
    } : null;
    res.status(200).json(response);
  });

router.post('/update',
  [
    security.authenticate,
    express.json({ type: 'application/json' })
  ],
  async function (req, res, next) {
    const messageId = req.body.id;
    findMessageByIdOrUuid(req.database.db, messageId, async (lookupErr, row) => {
      if (lookupErr) {
        return next(apiError.internal('db_error'));
      }
      if (!row) {
        return next(apiError.notFound('not_found'));
      }
      if (!ensureSameUser(req, res, row.userId, next)) {
        return;
      }
      if (isMessageLockedByModeration(row)) {
        return next(apiError.forbidden('message_locked_by_moderation'));
      }

      const rawMessage = String(req.body.message ?? '');
      const sanitizedMessage = sanitizeSingleQuotes(rawMessage);
      const sanitizedMultimedia = sanitizeSingleQuotes(req.body.multimedia);
      const latitude = Number.isFinite(Number(req.body.latitude)) ? Number(req.body.latitude) : row.latitude;
      const longitude = Number.isFinite(Number(req.body.longitude)) ? Number(req.body.longitude) : row.longitude;
      const plusCode = typeof req.body.plusCode === 'string' && req.body.plusCode.trim()
        ? req.body.plusCode.trim()
        : row.plusCode;
      const existingHashtags = decodeHashtags(row.hashtags);
      const parsedHashtags = req.body.hashtags === undefined
        ? { tags: existingHashtags, invalidTokens: [], overflow: 0 }
        : normalizeHashtags(req.body.hashtags, { max: MAX_PUBLIC_HASHTAGS });
      if (parsedHashtags.invalidTokens.length > 0 || parsedHashtags.overflow > 0) {
        return next(apiError.badRequest('invalid_hashtags'));
      }
      const hashtags = parsedHashtags.tags;
      const encodedHashtags = encodeHashtags(hashtags);
      const moderationInput = [rawMessage, formatHashtagsForModeration(hashtags)].filter(Boolean).join(' ').trim();
      const requiresModeration = [
        tableMessage.messageType.PUBLIC,
        tableMessage.messageType.COMMENT
      ].includes(row.typ);

      if (!requiresModeration) {
        tableMessage.update(
          req.database.db,
          row.id,
          sanitizedMessage,
          req.body.style,
          sanitizedMultimedia,
          latitude,
          longitude,
          plusCode,
          encodedHashtags,
          function (err) {
            if (err) {
              return next(apiError.internal('db_error'));
            }
            res.status(200).json({ status: 200 });
          });
        return;
      }

      const moderation = {};
      let status = tableMessage.messageStatus.ENABLED;
      let moderationDecision = null;
      let moderationScore = null;
      let moderationFlagged = null;
      let moderationReason = null;
      let moderationRequestSent = false;
      let moderationRequestId = null;

      moderation.patternMatch = detectPersonalInformation(moderationInput);
      moderation.patternMatchAt = Date.now();

      if (moderation.patternMatch) {
        moderationScore = null;
        moderationFlagged = true;
        moderationDecision = 'rejected';
        moderationReason = 'pattern';
        status = tableMessage.messageStatus.DISABLED;
      }

      try {
        if (!moderation.patternMatch) {
          const moderationResult = await openai.moderations.create({
            model: moderationModel,
            input: moderationInput
          });
          moderationScore = extractModerationScore(moderationResult);
          moderationFlagged = moderationResult?.results?.[0]?.flagged ?? false;
          moderationDecision = decideModeration(moderationScore, moderationFlagged);
          if (moderationDecision === 'rejected') {
            moderationReason = 'ai';
          }
          moderation.aiModeration = JSON.stringify(moderationResult);
          moderation.aiScore = moderationScore;
          moderation.aiFlagged = moderationFlagged;
          moderation.aiDecision = moderationDecision;
          moderation.aiCheckedAt = Date.now();
          if (moderationDecision === 'rejected') {
            status = tableMessage.messageStatus.DISABLED;
          }
        }
      } catch (err) {
        const apiErr = apiError.internal('openai_failed');
        apiErr.detail = err?.message || err;
        return next(apiErr);
      }

      tableMessage.updateWithModeration(
        req.database.db,
        row.id,
        sanitizedMessage,
        req.body.style,
        sanitizedMultimedia,
        latitude,
        longitude,
        plusCode,
        encodedHashtags,
        moderation,
        status,
        async function (err) {
          if (err) {
            return next(apiError.internal('db_error'));
          }

          if (moderationDecision === 'review') {
            const moderationPayload = {
              messageId: row.id,
              messageUuid: row.uuid,
              messageUserId: row.userId,
              messageText: rawMessage,
              messageType: row.typ,
              messageCreatedAt: row.createDateTime,
              latitude: row.latitude,
              longitude: row.longitude,
              plusCode: row.plusCode,
              markerType: row.markerType,
              style: req.body.style,
              hashtags,
              aiScore: moderationScore,
              aiFlagged: moderationFlagged,
              aiDecision: moderationDecision,
              aiResponse: moderation.aiModeration,
              patternMatch: moderation.patternMatch ?? null,
              patternMatchAt: moderation.patternMatchAt ?? null
            };
            const forward = await forwardModerationRequest(moderationPayload, req.logger);
            moderationRequestSent = forward.sent;
            moderationRequestId = forward.id ?? null;
          }

          res.status(200).json({
            status: 200,
            moderation: {
              decision: moderationDecision,
              reason: moderationReason,
              score: moderationScore,
              flagged: moderationFlagged,
              patternMatch: moderation.patternMatch ?? null,
              requestSent: moderationRequestSent,
              requestId: moderationRequestId
            }
          });
        }
      );
    });
  });

router.get('/disable/:messageId',
  [
    security.authenticate
  ],
  function (req, res, next) {
    findMessageByIdOrUuid(req.database.db, req.params.messageId, (lookupErr, row) => {
      if (lookupErr) {
        return next(apiError.internal('db_error'));
      }
      if (!row) {
        return next(apiError.notFound('not_found'));
      }
      if (!ensureSameUser(req, res, row.userId, next)) {
        return;
      }
      tableMessage.disableMessageTree(req.database.db, row.uuid, function (err) {
        if (err) {
          return next(apiError.internal('db_error'));
        }
        res.status(200).json({ status: 200 });
      });
    });
  });

router.get('/enable/:messageId',
  [
    security.authenticate
  ],
  function (req, res, next) {
    findMessageByIdOrUuid(req.database.db, req.params.messageId, async (lookupErr, row) => {
      if (lookupErr) {
        return next(apiError.internal('db_error'));
      }
      if (!row) {
        return next(apiError.notFound('not_found'));
      }
      if (!ensureSameUser(req, res, row.userId, next)) {
        return;
      }
      if (isMessageLockedByModeration(row)) {
        return next(apiError.forbidden('message_locked_by_moderation'));
      }
      if (isMessageRejectedByAutomatedModeration(row)) {
        return next(apiError.forbidden('message_rejected_by_moderation'));
      }
      try {
        const userRow = await getUserById(req.database.db, row.userId);
        if (!userRow) {
          return next(apiError.notFound('user_not_found'));
        }
        if (isPostingBlocked(userRow)) {
          return next(apiError.forbidden('user_blocked_for_posting'));
        }
      } catch (error) {
        req.logger?.warn?.('Failed to read user moderation status before message.enable', {
          error: error?.message || error,
          messageId: row.id,
          messageUuid: row.uuid,
          userId: row.userId
        });
        return next(apiError.internal('db_error'));
      }
      if (row.parentUuid) {
        try {
          const parentMessage = await getMessageByUuid(req.database.db, row.parentUuid);
          if (!parentMessage) {
            return next(apiError.notFound('parent_not_found'));
          }
          if (String(parentMessage.status || '').trim().toLowerCase() !== tableMessage.messageStatus.ENABLED) {
            return next(apiError.conflict('parent_not_available'));
          }
        } catch (error) {
          req.logger?.warn?.('Failed to read parent message before message.enable', {
            error: error?.message || error,
            messageId: row.id,
            messageUuid: row.uuid,
            parentUuid: row.parentUuid,
            userId: row.userId
          });
          return next(apiError.internal('db_error'));
        }
      }
      tableMessage.enableMessage(req.database.db, row.uuid, function (err) {
        if (err) {
          return next(apiError.internal('db_error'));
        }
        res.status(200).json({ status: 200 });
      });
    });
  });

router.get('/delete/:messageId',
  [
    security.authenticate
  ]
  , function (req, res, next) {
    findMessageByIdOrUuid(req.database.db, req.params.messageId, (lookupErr, row) => {
      if (lookupErr) {
        return next(apiError.internal('db_error'));
      }
      if (!row) {
        return next(apiError.notFound('not_found'));
      }
      if (!ensureSameUser(req, res, row.userId, next)) {
        return;
      }
      tableMessage.deleteById(req.database.db, row.id, function (err) {
        if (err) {
          return next(apiError.internal('db_error'));
        }
        res.status(200).json({ status: 200 });
      });
    });
  });

// Like-Toggle
router.get('/like/:messageUuid/by/:userId',
  [
    security.authenticate
  ]
  , (req, res, next) => {
    const messageUuid = String(req.params.messageUuid);
    const userId = String(req.params.userId);
    if (!ensureSameUser(req, res, userId, next)) {
      return;
    }
    if (!messageUuid || !userId) {
      return next(apiError.badRequest('invalid_message_or_user'));
    }

    tableLike.toggleLike(req.database.db, messageUuid, userId, (err, result) => {
      if (err) return next(apiError.internal('db_error'));

      // result enthält: liked, likes, dislikedByUser, dislikes
      res.status(200).json({ status: 200, ...result });
    });
  });

// Dislike-Toggle
router.get('/dislike/:messageUuid/by/:userId',
  [
    security.authenticate
  ]
  , (req, res, next) => {
    const messageUuid = String(req.params.messageUuid);
    const userId = String(req.params.userId);
    if (!ensureSameUser(req, res, userId, next)) {
      return;
    }
    if (!messageUuid || !userId) {
      return next(apiError.badRequest('invalid_message_or_user'));
    }

    tableDislike.toggleDislike(req.database.db, messageUuid, userId, (err, result) => {
      if (err) return next(apiError.internal('db_error'));

      // result enthält: disliked, dislikes, likedByUser, likes
      res.status(200).json({ status: 200, ...result });
    });
  });

router.get('/countview/:messageId', function (req, res, next) {
  tableMessage.countView(req.database.db, req.params.messageId, function (err) {
    if (err) {
      return next(apiError.internal('db_error'));
    }
    res.status(200).json({ status: 200 });
  });
});

router.get('/countcomment/:parentMessageId', function (req, res, next) {
  tableMessage.countComment(req.database.db, req.params.parentMessageId, function (err) {
    if (err) {
      return next(apiError.internal('db_error'));
    }
    res.status(200).json({ status: 200 });
  });
});

module.exports = router
