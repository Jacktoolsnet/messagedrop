const express = require('express');
const router = express.Router();
const security = require('../middleware/security');
const bodyParser = require('body-parser');
const tableUser = require('../db/tableUser');

router.get('/', [security.checkToken], function(req, res) {
  let response = {'status' : 0, 'rows' : []};
  tableUser.getAllUser(req.database.db, function(err, rows) {
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

router.post('/', [security.checkToken, bodyParser.json({ type: 'application/json' })], function(req, res) {
  let response = {'status' : 0};
  try {
    let userId = tableUser.createUser(req.database.db, req.body.publicKey);
    response.status = 200;
    response.userId = userId;
  } catch (error) {
    response.status = 500;
    response.error = error;
  } finally {
    res.setHeader('Content-Type', 'application/json');
    res.status(response.status);
    res.json(response);
  }
});

module.exports = router