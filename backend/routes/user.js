require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const uuid = require('uuid');
const security = require('../middleware/security');
const bodyParser = require('body-parser');
const tableUser = require('../db/tableUser');

router.get('/get', [security.checkToken], function (req, res) {
  let response = { 'status': 0, 'rows': [] };
  tableUser.getAll(req.database.db, function (err, rows) {
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
    res.status(response.status).json(response);
  });
});

router.get('/get/:userId', [security.checkToken], function (req, res) {
  let response = { 'status': 0 };
  tableUser.getById(req.database.db, req.params.userId, function (err, row) {
    if (err) {
      response.status = 500;
      response.error = err;
    } else {
      if (!row) {
        response.rawUser = {};
        response.status = 404;
      } else {
        response.rawUser = row;
        response.status = 200;
      }
    }
    res.status(response.status).json(response);
  });
});

router.post('/hashpin', [security.checkToken, bodyParser.json({ type: 'application/json' })], function (req, res) {
  let response = { 'status': 0 };

  if (!req.body.pin || typeof req.body.pin !== 'string' || req.body.pin.length !== 4) {
    response.status = 400;
    response.error = 'Invalid PIN';
    return res.status(400).json(response);
  }

  try {
    crypto.scrypt(req.body.pin, process.env.PIN_SALT, 64, (err, derivedKey) => {
      if (err) {
        response.status = 500;
        response.error = 'Hashing failed';
        return res.status(500).json(response);
      }

      response.status = 200;
      response.pinHash = derivedKey.toString('hex');
      return res.status(200).json(response);
    });
  } catch (err) {
    response.status = 500;
    response.error = 'Hashing failed';
    return res.status(500).json(err);
  }

});

router.post('/create', [security.checkToken, bodyParser.json({ type: 'application/json' })], function (req, res) {
  let response = { 'status': 0 };
  let userId;
  if (undefined === req.body.userId || req.body.userId === '') {
    userId = uuid.v4();
  } else {
    userId = req.body.userId;
  }
  tableUser.create(req.database.db, userId, req.body.encryptionPublicKey, req.body.signingPublicKey, req.body.subscription, function (err) {
    if (err) {
      response.status = 500;
      response.error = err;
    } else {
      response.status = 200;
      response.userId = userId;
    }
    res.status(response.status).json(response);
  });
});

router.get('/clean', [security.checkToken], function (req, res) {
  let response = { 'status': 0 };
  tableUser.clean(req.database.db, function (err) {
    if (err) {
      response.status = 500;
      response.error = err;
    } else {
      response.status = 200;
    }
    res.status(response.status).json(response);
  });
});

router.get('/delete/:userId', [security.checkToken], function (req, res) {
  let response = { 'status': 0 };
  tableUser.deleteById(req.database.db, req.params.userId, function (err) {
    if (err) {
      response.status = 500;
      response.error = err;
    } else {
      response.status = 200;
    }
    res.status(response.status).json(response);
  });
});

router.post('/subscribe', [security.checkToken, bodyParser.json({ type: 'application/json' })], function (req, res) {
  let response = { 'status': 0 };
  tableUser.subscribe(req.database.db, req.body.userId, req.body.subscription, function (err) {
    if (err) {
      response.status = 500;
      response.error = err;
    } else {
      response.status = 200;
    }
    res.status(response.status).json(response);
  });
});

router.get('/unsubscribe/:userId', [security.checkToken], function (req, res) {
  let response = { 'status': 0 };
  tableUser.unsubscribe(req.database.db, req.params.userId, function (err) {
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