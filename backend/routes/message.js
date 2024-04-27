const express = require('express');
const pluscodes = require('pluscodes')
const router = express.Router();
const security = require('../middleware/security');
const bodyParser = require('body-parser');
const tableMessage = require('../db/tableMessage');

router.get('/get', [security.checkToken], function(req, res) {
  let response = {'status' : 0, 'rows' : []};
  tableMessage.getAll(req.database.db, function(err, rows) {
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

router.get('/get/id/:messageId', [security.checkToken], function(req, res) {
  let response = {'status' : 0};
  tableMessage.getById(req.database.db, req.params.messageId, function(err, row) {
    if (err) {
      response.status = 500;
      response.error = err;
    } else {
      if (!row) {
        response.message = {};
        response.status = 404;
      } else {
        response.message = row;
        response.status = 200;
      }
    }
    res.setHeader('Content-Type', 'application/json');      
    res.status(response.status);
    res.json(response);
  });
});

router.get('/get/pluscode/:plusCode', [security.checkToken], function(req, res) {
  let response = {'status' : 0, 'rows' : []};
  // It is not allowed to get all messages with this route.
  if (req.params.plusCode.length < 2 || req.params.plusCode.length > 11) {
    response.status = 500;
    res.json(response);
  } else {
    if (req.params.plusCode.length > 1 && req.params.plusCode.length < 11) {
      req.params.plusCode = `${req.params.plusCode}%` 
    }
    tableMessage.getByPlusCode(req.database.db, req.params.plusCode, function(err, rows) {
      if (err) {
        response.status = 500;
        response.error = err;
      } else {
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
      }
      res.setHeader('Content-Type', 'application/json');      
      res.status(response.status);
      res.json(response);
    });
  }
});

router.post('/create', [security.checkToken, bodyParser.json({ type: 'application/json' })], function(req, res) {
  let response = {'status' : 0};
  let plusCode = pluscodes.encode({ latitude: req.body.latitude, longitude: req.body.longitude });
  tableMessage.create(req.database.db, req.body.messageTyp, req.body.latitude, req.body.longitude, plusCode, req.body.message, req.body.messageUserId, function (err) {
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

router.get('/clean', [security.checkToken], function(req, res) {
  let response = {'status' : 0};
  console.log('clean');
  tableMessage.clean(req.database.db, function(err) {
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

router.put('/disable/:messageId', [security.checkToken], function(req, res) {
  let response = {'status' : 0};
  tableMessage.disableMessage(req.database.db, req.params.messageId, function(err) {
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

router.put('/enable/:messageId', [security.checkToken], function(req, res) {
  let response = {'status' : 0};
  tableMessage.enableMessage(req.database.db, req.params.messageId, function(err) {
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

router.delete('/delete/:messageId', [security.checkToken], function(req, res) {
  let response = {'status' : 0};
  tableMessage.deleteById(req.database.db, req.params.messageId, function(err) {
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