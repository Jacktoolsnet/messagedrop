const express = require('express');
const router = express.Router();
const security = require('../middleware/security');
const bodyParser = require('body-parser');
const tableLocationPushSubscription = require('../db/tableLocationPushSubscription');

router.post('/subscribe', [security.checkToken, bodyParser.json({ type: 'application/json' })], function(req, res) {
  let response = {'status' : 0};
  tableLocationPushSubscription.subscribe(req.database.db, req.body.userId, req.body.plusCode, req.body.endpoint, req.body.expirationTime, req.body.p256dh, req.body.auth, function (err) {
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

router.get('/get/:userId/:plusCode', [security.checkToken], function(req, res) {
  let response = {'status' : 0};
  tableLocationPushSubscription.isUserSubscribedToLocation(req.database.db, req.params.userId, req.params.plusCode, function(err, row) {
    if (err) {
      response.status = 500;
      response.error = err;
    } else {
      if (row.subscribedByUser != 0) {
        response.status = 200;
      } else {
        response.status = 404;
      }
    }
    res.setHeader('Content-Type', 'application/json');      
    res.status(response.status);
    res.json(response);
  });
});


router.get('/unsubscribe/:userId/:plusCode', [security.checkToken], function(req, res) {
  let response = {'status' : 0};
  tableLocationPushSubscription.unsubscribe(req.database.db, req.params.userId, req.params.plusCode, function(err) {
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