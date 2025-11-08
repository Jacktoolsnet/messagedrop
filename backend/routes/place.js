const express = require('express');
const { getEncryptionPublicKey } = require('../utils/keyStore');
const cryptoUtil = require('../utils/cryptoUtils');
const router = express.Router();
const crypto = require('crypto');
const security = require('../middleware/security');
const tablePlace = require('../db/tablePlace');
const geoTz = require('geo-tz');
const metric = require('../middleware/metric');

router.use(security.checkToken);

router.post('/create',
  [
    security.authenticate,
    express.json({ type: 'application/json' }),
    metric.count('place.create', { when: 'always', timezone: 'utc', amount: 1 })
  ]
  , async function (req, res) {
    let response = { 'status': 0 };
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

router.get('/get/:placeId',
  [
    security.authenticate
  ]
  , function (req, res) {
    let response = { 'status': 0 };
    tablePlace.getById(req.database.db, req.params.placeId, function (err, row) {
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

router.get('/get/userId/:userId/name/:name', security.authenticate, function (req, res) {
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

router.get('/unsubscribe/:placeId',
  [
    security.authenticate
  ], function (req, res) {
    let response = { 'status': 0 };
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

router.get('/delete/:placeId',
  [
    security.authenticate
  ]
  , function (req, res) {
    let response = { 'status': 0 };
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
