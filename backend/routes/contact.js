const express = require('express');
const router = express.Router();
const uuid = require('uuid');
const security = require('../middleware/security');
const bodyParser = require('body-parser');
const tableContact = require('../db/tableContact');

router.post('/create', [security.checkToken, bodyParser.json({ type: 'application/json' })], function (req, res) {
  let response = { 'status': 0 };
  let contactId = uuid.v4()
  tableContact.create(req.database.db, contactId, req.body.userId, req.body.contactUserId, function (err) {
    if (err) {
      response.status = 500;
      response.error = err;
    } else {
      response.status = 200;
      response.placeId = contactId;
    }
    res.setHeader('Content-Type', 'application/json');
    res.status(response.status);
    res.json(response);
  });
});

router.get('/get/:contactId', [security.checkToken], function (req, res) {
  let response = { 'status': 0 };
  tableContact.getById(req.database.db, req.params.contactId, function (err, row) {
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
    res.setHeader('Content-Type', 'application/json');
    res.status(response.status);
    res.json(response);
  });
});

router.get('/get/userId/:userId', [security.checkToken], function (req, res) {
  let response = { 'status': 0, 'rows': [] };
  tableContact.getByUserId(req.database.db, req.params.userId, function (err, rows) {
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
            'contactUserId': row.contactUserId,
            'subscribed': row.subscribed === 0 ? false : true
          });
        });
      }
    }
    res.setHeader('Content-Type', 'application/json');
    res.status(response.status);
    res.json(response);
  });
});

router.get('/subscribe/:contactId', [security.checkToken, bodyParser.json({ type: 'application/json' })], function (req, res) {
  let response = { 'status': 0 };
  tableContact.subscribe(req.database.db, req.params.contactId, function (err) {
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

router.get('/unsubscribe/:contactId', [security.checkToken], function (req, res) {
  let response = { 'status': 0 };
  tableContact.unsubscribe(req.database.db, req.params.contactId, function (err) {
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

router.get('/delete/:contactId', [security.checkToken], function (req, res) {
  let response = { 'status': 0 };
  tableContact.deleteById(req.database.db, req.params.contactId, function (err) {
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