const express = require('express');
const router = express.Router();
const security = require('../middleware/security');
const tableStatistic = require('../db/tableStatistic');

router.get('/get', [security.checkToken], function (req, res) {
  let response = { 'status': 0, 'rows': [] };
  tableStatistic.getAll(req.database.db, function (err, rows) {
    if (err) {
      response.status = 500;
      response.error = err;
    } else {
      rows.forEach((row) => {
        response.rows.push(row);
      });
      response.status = 200;
    }
    res.setHeader('Content-Type', 'application/json');
    res.status(response.status);
    res.json(response);
  });
});

router.get('/count/visitor', [security.checkToken], function (req, res) {
  let response = { 'status': 0 };
  tableStatistic.countVisitor(req.database.db, function (err) {
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

router.get('/count/message', [security.checkToken], function (req, res) {
  let response = { 'status': 0 };
  tableStatistic.countMessage(req.database.db, function (err) {
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

router.get('/clean', [security.checkToken], function (req, res) {
  let response = { 'status': 0 };
  tableStatistic.clean(req.database.db, function (err) {
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