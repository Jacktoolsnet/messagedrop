const express = require('express');
const router = express.Router();
const security = require('../middleware/security');
const tableMessage = require('../db/tableMessage');
const tableLike = require('../db/tableLike');
const tableDislike = require('../db/tableDislike');
const notify = require('../utils/notify');
const metric = require('../middleware/metric');
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
    security.authenticate,
    express.json({ type: 'application/json' }),
    metric.count('message.create', { when: 'always', timezone: 'utc', amount: 1 })
  ]
  , function (req, res, next) {
    let response = { 'status': 0 };
    if (!ensureSameUser(req, res, req.body.messageUserId, next)) {
      return;
    }
    if (undefined == req.body.parentMessageId) {
      req.body.parentMessageId = 0;
    }
    tableMessage.create(
      req.database.db,
      req.body.uuid,
      req.body.parentUuid,
      req.body.messageTyp,
      req.body.latitude,
      req.body.longitude,
      req.body.plusCode,
      sanitizeSingleQuotes(req.body.message),
      req.body.markerType,
      req.body.style,
      req.body.messageUserId,
      sanitizeSingleQuotes(req.body.multimedia),
      function (err) {
        if (err) {
          return next(apiError.internal('db_error'));
        }
        notify.placeSubscriptions(
          req.logger,
          req.database.db,
          req.body.latitude,
          req.body.longitude,
          req.body.messageUserId,
          sanitizeSingleQuotes(req.body.message)
        );
        response.status = 200;
        res.status(200).json(response);
      }
    );
  });

router.post('/update',
  [
    security.authenticate,
    express.json({ type: 'application/json' })
  ],
  function (req, res, next) {
    const messageId = req.body.id;
    findMessageByIdOrUuid(req.database.db, messageId, (lookupErr, row) => {
      if (lookupErr) {
        return next(apiError.internal('db_error'));
      }
      if (!row) {
        return next(apiError.notFound('not_found'));
      }
      if (!ensureSameUser(req, res, row.userId, next)) {
        return;
      }
      tableMessage.update(
        req.database.db,
        row.id,
        sanitizeSingleQuotes(req.body.message),
        req.body.style,
        sanitizeSingleQuotes(req.body.multimedia),
        function (err) {
          if (err) {
            return next(apiError.internal('db_error'));
          }
          res.status(200).json({ status: 200 });
        });
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
