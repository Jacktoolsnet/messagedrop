const express = require('express');
const router = express.Router();
const security = require('../middleware/security');
const bodyParser = require('body-parser');
const tablePlace = require('../db/tablePlace');

router.post('/create', [security.checkToken, bodyParser.json({ type: 'application/json' })], function(req, res) {
  let response = {'status' : 0};
  tablePlace.create(req.database.db, req.body.userId, req.body.name.replace(/\'/g,"''"), function (err) {
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

router.post('/update', [security.checkToken, bodyParser.json({ type: 'application/json' })], function(req, res) {
  let response = {'status' : 0};
  tablePlace.update(req.database.db, req.body.id, req.body.name.replace(/\'/g,"''"), function(err) {
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

router.get('/get/:placeId', [security.checkToken], function(req, res) {
  let response = {'status' : 0};
  tablePlace.getById(req.database.db, req.params.placeId, function(err, row) {
    if (err) {
      response.status = 500;
      response.error = err;
    } else {
      if (!row) {
        response.status = 404;
      } else {
        response.status = 200;
        response.location = row;
      }
    }
    res.setHeader('Content-Type', 'application/json');      
    res.status(response.status);
    res.json(response);
  });
});

router.get('/get/userId/:userId', [security.checkToken], function(req, res) {
  let response = {'status' : 0, 'rows' : []};
  tablePlace.getByUserId(req.database.db, req.params.userId, function(err, rows) {
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

router.post('/subscribe', [security.checkToken, bodyParser.json({ type: 'application/json' })], function(req, res) {
  let response = {'status' : 0};
  tablePlace.subscribe(req.database.db, req.body.placeId, req.body.subscription, function (err) {
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

router.get('/unsubscribe/:placeId', [security.checkToken], function(req, res) {
  let response = {'status' : 0};
  tablePlace.unsubscribe(req.database.db, req.params.placeId, function(err) {
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

router.get('/delete/:placeId', [security.checkToken], function(req, res) {
  let response = {'status' : 0};
  tablePlace.deleteById(req.database.db, req.params.placeId, function(err) {
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