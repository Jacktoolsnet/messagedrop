const express = require('express');
const router = express.Router();
const uuid = require('uuid');
const security = require('../middleware/security');
const bodyParser = require('body-parser');
const tableUser = require('../db/tableUser');

router.get('/get', [security.checkToken], function(req, res) {
  let response = {'status' : 0, 'rows' : []};
  tableUser.getAll(req.database.db, function(err, rows) {
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

router.get('/get/:userId', [security.checkToken], function(req, res) {
  let response = {'status' : 0};
  tableUser.getById(req.database.db, req.params.userId, function(err, row) {
    if (err) {
      response.status = 500;
      response.error = err;
    } else {
      if (!row) {
        response.user = {};
        response.status = 404;
      } else {
        response.user = row;
        response.status = 200;
      }
    }
    res.setHeader('Content-Type', 'application/json');      
    res.status(response.status);
    res.json(response);
  });
});

router.post('/create', [security.checkToken, bodyParser.json({ type: 'application/json' })], function(req, res) {
  let response = {'status' : 0};
  let userId;
  if (undefined === req.body.userId || req.body.userId === '') {
    userId = uuid.v4();
  } else {
    userId = req.body.userId;
  }
  tableUser.create(req.database.db, userId, req.body.encryptionPublicKey, req.body.signingPublicKey, function (err) {
    if (err) {
      response.status = 500;
      response.error = err;
    } else {
      response.status = 200;
      response.userId = userId;
    }
    res.setHeader('Content-Type', 'application/json');
    res.status(response.status);
    res.json(response);
  });
});

router.get('/clean', [security.checkToken], function(req, res) {
  let response = {'status' : 0};
  tableUser.clean(req.database.db, function(err) {
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

router.get('/delete/:userId', [security.checkToken], function(req, res) {
  let response = {'status' : 0};
  tableUser.deleteById(req.database.db, req.params.userId, function(err) {
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