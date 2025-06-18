const express = require('express');
const { getEncryptionPublicKey } = require('../utils/keyStore');
const cryptoUtil = require('../utils/cryptoUtils');
const router = express.Router();
const uuid = require('uuid');
const security = require('../middleware/security');
const bodyParser = require('body-parser');
const tablePlace = require('../db/tablePlace');

router.post('/create', [security.checkToken, bodyParser.json({ type: 'application/json' })], async function (req, res) {
  let response = { 'status': 0 };
  let placeId = uuid.v4()
  let cryptedPlaceName = await cryptoUtil.encrypt(await getEncryptionPublicKey(), req.body.name.replace(/\'/g, "''"));
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

router.post('/update', [security.checkToken, bodyParser.json({ type: 'application/json' })], async function (req, res) {
  let response = { 'status': 0 };
  let cryptedPlaceName = await cryptoUtil.encrypt(await getEncryptionPublicKey(), req.body.name.replace(/\'/g, "''"));
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

router.get('/get/:placeId', [security.checkToken], function (req, res) {
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

router.get('/get/userId/:userId/name/:name', [security.checkToken], function (req, res) {
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

router.get('/get/userId/:userId', [security.checkToken], function (req, res) {
  let response = { 'status': 0, 'rows': [] };
  tablePlace.getByUserId(req.database.db, req.params.userId, function (err, rows) {
    if (err) {
      response.status = 500;
      response.error = err;
    } else {
      response.status = 200;
      if (rows.length == 0) {
        response.status = 404;
      } else {
        rows.forEach((row) => {
          response.rows.push({
            'id': row.id,
            'userId': row.userId,
            'name': row.name,
            'subscribed': row.subscribed === 0 ? false : true,
            'plusCodes': row.plusCodes
          });
        });
      }
    }
    res.status(response.status).json(response);
  });
});

router.get('/subscribe/:placeId', [security.checkToken, bodyParser.json({ type: 'application/json' })], function (req, res) {
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

router.get('/unsubscribe/:placeId', [security.checkToken], function (req, res) {
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

router.get('/delete/:placeId', [security.checkToken], function (req, res) {
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

module.exports = router