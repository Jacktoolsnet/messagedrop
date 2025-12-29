const express = require('express');
const router = express.Router();
const security = require('../middleware/security');
const tableMessage = require('../db/tableMessage');
const tableLike = require('../db/tableLike');
const tableDislike = require('../db/tableDislike');
const notify = require('../utils/notify');
const metric = require('../middleware/metric');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const OpenAI = require('openai');
const { signServiceJwt } = require('../utils/serviceJwt');
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

function findMessageByIdOrUuid(db, messageId, callback) {
  const raw = String(messageId ?? '');
  const isNumeric = /^\d+$/.test(raw);
  if (isNumeric) {
    return tableMessage.getById(db, raw, callback);
  }
  return tableMessage.getByUuid(db, raw, callback);
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

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const moderationModel = process.env.OPENAI_MODERATION_MODEL || 'omni-moderation-latest';
const adminAudience = process.env.SERVICE_JWT_AUDIENCE_ADMIN || 'service.admin-backend';

function detectPersonalInformation(text) {
  const patterns = [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
    /\b(?:\d[ -]*?){13,19}\b/,
    /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}\b/,
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/,
    /\b(?:[a-fA-F0-9:]+:+)+[a-fA-F0-9]+\b/,
    /\b\d{3}-\d{2}-\d{4}\b/
  ];

  if (patterns.some(pattern => pattern.test(text))) {
    return true;
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

function decideModeration(score) {
  if (score > 0.6) return 'rejected';
  if (score >= 0.4) return 'review';
  return 'approved';
}

async function forwardModerationRequest(payload, logger) {
  const base = (process.env.ADMIN_BASE_URL || '').replace(/\/+$/, '');
  const port = process.env.ADMIN_PORT;
  if (!base || !port) {
    return { sent: false };
  }
  const url = `${base}:${port}/moderation/requests`;
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
      return next(apiError.notFound('not_found'));
    }
    res.status(200).json({ status: 200, rows });
  });
});

router.get('/get/comment/:parentUuid', function (req, res, next) {
  tableMessage.getByParentUuid(req.database.db, req.params.parentUuid, function (err, rows) {
    if (err) {
      return next(apiError.internal('db_error'));
    }
    if (!rows || rows.length === 0) {
      return next(apiError.notFound('not_found'));
    }
    res.status(200).json({ status: 200, rows });
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
        if (!rows || rows.length === 0) {
          return next(apiError.notFound('not_found'));
        }
        response.rows = rows;
        response.status = 200;
        res.status(200).json(response);
      }
    );
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
    if (undefined == req.body.parentMessageId) {
      req.body.parentMessageId = 0;
    }
    const rawMessage = String(req.body.message ?? '');
    const sanitizedMessage = sanitizeSingleQuotes(rawMessage);
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
      const patternMatch = detectPersonalInformation(rawMessage);
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
            input: rawMessage
          });
          moderationScore = extractModerationScore(moderationResult);
          moderationFlagged = moderationResult?.results?.[0]?.flagged ?? false;
          moderationDecision = decideModeration(moderationScore);
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
        req.body.parentUuid,
        req.body.messageTyp,
        req.body.latitude,
        req.body.longitude,
        req.body.plusCode,
        sanitizedMessage,
        req.body.markerType,
        req.body.style,
        req.body.messageUserId,
        sanitizeSingleQuotes(req.body.multimedia),
        { status, moderation },
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
        sanitizedMessage
      );
    }

    response.status = 200;
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

      const rawMessage = String(req.body.message ?? '');
      const sanitizedMessage = sanitizeSingleQuotes(rawMessage);
      const sanitizedMultimedia = sanitizeSingleQuotes(req.body.multimedia);
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

      moderation.patternMatch = detectPersonalInformation(rawMessage);
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
            input: rawMessage
          });
          moderationScore = extractModerationScore(moderationResult);
          moderationFlagged = moderationResult?.results?.[0]?.flagged ?? false;
          moderationDecision = decideModeration(moderationScore);
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
      tableMessage.disableMessage(req.database.db, row.uuid, function (err) {
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
