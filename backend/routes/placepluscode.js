const express = require('express');
const router = express.Router();
const security = require('../middleware/security');
const bodyParser = require('body-parser');
const tablePlacePlusCode = require('../db/tablePlacePlusCode');

router.get('/create/:placeId/:plusCode', [security.checkToken, bodyParser.json({ type: 'application/json' })], function (req, res) {
  let response = { 'status': 0 };
  tablePlacePlusCode.create(req.database.db, req.params.placeId, req.params.plusCode, function (err) {
    if (err) {
      response.status = 500;
      response.error = err;
    } else {
      response.status = 200;
    }
    res.setHeader('Content-Type', 'application/json');
    res.status(response.status);
    res.json(response);
  });
});

router.get('/byPlaceId/:placeId', [security.checkToken], function (req, res) {
  let response = { 'status': 0, 'rows': [] };
  tablePlacePlusCode.getByPlaceId(req.database.db, req.params.placeId, function (err, rows) {
    if (err) {
      response.status = 500;
      response.error = err;
    } else {
      if (rows.length == 0) {
        response.status = 404;
      } else {
        rows.forEach((row) => {
          response.rows.push(row);
        });
        response.status = 200;
      }
    }
    res.setHeader('Content-Type', 'application/json');
    res.status(response.status);
    res.json(response);
  });
});

router.get('/remove/:placeId/:plusCode', [security.checkToken], function (req, res) {
  let response = { 'status': 0 };
  tablePlacePlusCode.remove(req.database.db, req.params.placeId, req.params.plusCode, function (err) {
    if (err) {
      response.status = 500;
      response.error = err;
    } else {
      response.status = 200;
    }
    res.setHeader('Content-Type', 'application/json');
    res.status(response.status);
    res.json(response);
  });
});

module.exports = router