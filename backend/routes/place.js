const express = require('express');
const { getEncryptionPublicKey } = require('../utils/keyStore');
const cryptoUtil = require('../utils/cryptoUtils');
const router = express.Router();
const crypto = require('crypto');
const security = require('../middleware/security');
const tablePlace = require('../db/tablePlace');
const geoTz = require('geo-tz');
const metric = require('../middleware/metric');

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

function withPlaceOwnership(req, res, placeId, handler) {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return res.status(401).json({ status: 401, error: 'unauthorized' });
  }
  tablePlace.getById(req.database.db, placeId, (err, row) => {
    if (err) {
      return res.status(500).json({ status: 500, error: err });
    }
    if (!row) {
      return res.status(404).json({ status: 404, error: 'not_found' });
    }
    if (String(row.userId) !== String(authUserId)) {
      return res.status(403).json({ status: 403, error: 'forbidden' });
    }
    try {
      Promise.resolve(handler(row)).catch((handlerErr) => {
        res.status(500).json({ status: 500, error: handlerErr?.message || handlerErr });
      });
    } catch (handlerErr) {
      res.status(500).json({ status: 500, error: handlerErr?.message || handlerErr });
    }
  });
}

router.post('/create',
  [
    security.authenticate,
    express.json({ type: 'application/json' }),
    metric.count('place.create', { when: 'always', timezone: 'utc', amount: 1 })
  ]
  , async function (req, res) {
    let response = { 'status': 0 };
    if (!ensureSameUser(req, res, req.body.userId)) {
      return;
    }
    let placeId = crypto.randomUUID();
    let cryptedPlaceName = await cryptoUtil.encrypt(await getEncryptionPublicKey(), req.body.name.replace(/'/g, "''"));
    tablePlace.create(req.database.db, placeId, req.body.userId, JSON.stringify(cryptedPlaceName), req.body.latMin, req.body.latMax, req.body.lonMin, req.body.lonMax, function (err) {
      if (err) {
        response.status = 500;
        response.error = err;
      } else {
        response.status = 200;
        response.placeId = placeId;
      }
      res.status(response.status).json(response);
    });
  });

router.post('/update',
  [
    security.authenticate,
    express.json({ type: 'application/json' })
  ]
  , async function (req, res) {
    let response = { 'status': 0 };
    withPlaceOwnership(req, res, req.body.id, async () => {
      let cryptedPlaceName = await cryptoUtil.encrypt(await getEncryptionPublicKey(), req.body.name.replace(/'/g, "''"));
      tablePlace.update(req.database.db, req.body.id, JSON.stringify(cryptedPlaceName), req.body.latMin, req.body.latMax, req.body.lonMin, req.body.lonMax, function (err) {
        if (err) {
          response.status = 500;
          response.error = err;
        } else {
          response.status = 200;
        }
        res.status(response.status).json(response);
      });
    });
  });

router.get('/get/:placeId',
  [
    security.authenticate
  ]
  , function (req, res) {
    let response = { 'status': 0 };
    withPlaceOwnership(req, res, req.params.placeId, (row) => {
      response.status = 200;
      response.place = row;
      res.status(response.status).json(response);
    });
  });

router.get('/get/userId/:userId/name/:name', security.authenticate, function (req, res) {
  if (!ensureSameUser(req, res, req.params.userId)) {
    return;
  }
  let response = { 'status': 0 };
  tablePlace.getByUserIdAndName(req.database.db, req.params.userId, req.params.name, function (err, row) {
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

router.get('/get/userId/:userId',
  [
    security.authenticate
  ]
  , function (req, res) {
    if (!ensureSameUser(req, res, req.params.userId)) {
      return;
    }
    let response = { 'status': 0, 'rows': [] };
    tablePlace.getByUserId(req.database.db, req.params.userId, function (err, rows) {
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
              'name': row.name,
              'subscribed': row.subscribed === 0 ? false : true,
              'pinned': row.pinned === 0 ? false : true,
              'plusCodes': row.plusCodes
            });
          });
        }
      }
      res.status(response.status).json(response);
    });
  });

router.get('/subscribe/:placeId',
  [
    security.authenticate,
    express.json({ type: 'application/json' })
  ]
  , function (req, res) {
    let response = { 'status': 0 };
    withPlaceOwnership(req, res, req.params.placeId, () => {
      tablePlace.subscribe(req.database.db, req.params.placeId, function (err) {
        if (err) {
          response.status = 500;
          response.error = err;
        } else {
          response.status = 200;
        }
        res.status(response.status).json(response);
      });
    });
  });

router.get('/unsubscribe/:placeId',
  [
    security.authenticate
  ], function (req, res) {
    let response = { 'status': 0 };
    withPlaceOwnership(req, res, req.params.placeId, () => {
      tablePlace.unsubscribe(req.database.db, req.params.placeId, function (err) {
        if (err) {
          response.status = 500;
          response.error = err;
        } else {
          response.status = 200;
        }
        res.status(response.status).json(response);
      });
    });
  });

router.get('/delete/:placeId',
  [
    security.authenticate
  ]
  , function (req, res) {
    let response = { 'status': 0 };
    withPlaceOwnership(req, res, req.params.placeId, () => {
      tablePlace.deleteById(req.database.db, req.params.placeId, function (err) {
        if (err) {
          response.status = 500;
          response.error = err;
        } else {
          response.status = 200;
        }
        res.status(response.status).json(response);
      });
    });
  });

router.get('/timezone/:latitude/:longitude',
  [
    express.json({ type: 'application/json' })
  ]
  , function (req, res) {
    let response = { 'status': 0 };
    try {
      const lat = parseFloat(req.params.latitude);
      const lon = parseFloat(req.params.longitude);
      const [timezone] = geoTz.find(lat, lon);

      response.status = 200;
      response.timezone = timezone;
      res.status(200).json(response);
    } catch (err) {
      console.error(err);
      response.status = 500;
      response.error = 'Could not determine timezone';
      res.status(500).json(response);
    }
  });

module.exports = router
