const express = require('express');
const router = express.Router();
const security = require('../middleware/security');
const bodyParser = require('body-parser');
const tableUser = require('../db/tableStatistic');

router.get('/get/', [security.checkToken], function(req, res) {
  let response = {'status' : 0, 'rows' : []};
  tableUser.getAll(req.database.db, function(err, rows) {
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

router.get('/clean', [security.checkToken], function(req, res) {
  let response = {'status' : 0};
  console.log('clean');
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


module.exports = router