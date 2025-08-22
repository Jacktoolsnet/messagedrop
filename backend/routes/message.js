const express = require('express');
const router = express.Router();
const security = require('../middleware/security');
const bodyParser = require('body-parser');
const tableMessage = require('../db/tableMessage');
const tableLike = require('../db/tableLike');
const tableDislike = require('../db/tableDislike');
const notify = require('../utils/notify');

router.get('/get', [security.checkToken], function (req, res) {
  let response = { 'status': 0, 'rows': [] };
  tableMessage.getAll(req.database.db, function (err, rows) {
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

router.get('/get/id/:messageId', [security.checkToken], function (req, res) {
  let response = { 'status': 0 };
  tableMessage.getById(req.database.db, req.params.messageId, function (err, row) {
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
    res.status(response.status).json(response);
  });
});

router.get('/get/userId/:userId', [security.checkToken], function (req, res) {
  let response = { 'status': 0, 'rows': [] };
  tableMessage.getByUserId(req.database.db, req.params.userId, function (err, rows) {
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

router.get('/get/comment/:parentUuid', [security.checkToken], function (req, res) {
  let response = { 'status': 0, 'rows': [] };
  tableMessage.getByParentUuid(req.database.db, req.params.parentUuid, function (err, rows) {
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

router.get('/get/pluscode/:plusCode', [security.checkToken], function (req, res) {
  let response = { 'status': 0, 'rows': [] };
  // It is not allowed to get all messages with this route.
  if (req.params.plusCode.length < 2 || req.params.plusCode.length > 11) {
    response.status = 500;
    res.json(response);
  } else {
    if (req.params.plusCode.length > 1 && req.params.plusCode.length < 11) {
      req.params.plusCode = `${req.params.plusCode}%`
    }
    tableMessage.getByPlusCode(req.database.db, req.params.plusCode, function (err, rows) {
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
      res.status(response.status).json(response);
    });
  }
});

router.post('/create', [security.checkToken, security.authenticate, bodyParser.json({ type: 'application/json' })], function (req, res) {
  let response = { 'status': 0 };
  if (undefined == req.body.parentMessageId) {
    req.body.parentMessageId = 0;
  }
  tableMessage.create(req.database.db, req.body.uuid, req.body.parentUuid, req.body.messageTyp, req.body.latitude, req.body.longitude, req.body.plusCode, req.body.message.replace(/\'/g, "''"), req.body.markerType, req.body.style, req.body.messageUserId, req.body.multimedia.replace(/\'/g, "''"), function (err) {
    if (err) {
      response.status = 500;
      response.error = err;
    } else {
      notify.placeSubscriptions(req.logger, req.database.db, req.body.latitude, req.body.longitude, req.body.messageUserId, req.body.message.replace(/\'/g, "''"));
      response.status = 200;
    }
    res.status(response.status).json(response);
  });
});

router.post('/update', [security.checkToken, security.authenticate, bodyParser.json({ type: 'application/json' })], function (req, res) {
  let response = { 'status': 0 };
  tableMessage.update(req.database.db, req.body.id, req.body.message.replace(/\'/g, "''"), req.body.style, req.body.multimedia.replace(/\'/g, "''"), function (err) {
    if (err) {
      response.status = 500;
      response.error = err;
    } else {
      response.status = 200;
    }
    res.status(response.status).json(response);
  });
});

router.get('/clean/public', [security.checkToken], function (req, res) {
  let response = { 'status': 0 };
  tableMessage.cleanPublic(req.database.db, function (err) {
    if (err) {
      response.status = 500;
      response.error = err;
    } else {
      response.status = 200;
    }
    res.status(response.status).json(response);
  });
});

router.get('/disable/:messageId', [security.checkToken], function (req, res) {
  let response = { 'status': 0 };
  tableMessage.disableMessage(req.database.db, req.params.messageId, function (err) {
    if (err) {
      response.status = 500;
      response.error = err;
    } else {
      response.status = 200;
    }
    res.status(response.status).json(response);
  });
});

router.get('/enable/:messageId', [security.checkToken], function (req, res) {
  let response = { 'status': 0 };
  tableMessage.enableMessage(req.database.db, req.params.messageId, function (err) {
    if (err) {
      response.status = 500;
      response.error = err;
    } else {
      response.status = 200;
    }
    res.status(response.status).json(response);
  });
});

router.get('/delete/:messageId', [security.checkToken, security.authenticate], function (req, res) {
  let response = { 'status': 0 };
  tableMessage.deleteById(req.database.db, req.params.messageId, function (err) {
    if (err) {
      response.status = 500;
      response.error = err;
    } else {
      response.status = 200;
    }
    res.status(response.status).json(response);
  });
});

// Like-Toggle
router.get('/like/:messageId/by/:userId', [security.checkToken, security.authenticate], (req, res) => {
  const messageId = Number(req.params.messageId);
  const userId = String(req.params.userId);
  if (!Number.isInteger(messageId) || !userId) {
    return res.status(400).json({ status: 400, error: 'Invalid messageId or userId' });
  }

  tableLike.toggleLike(req.database.db, messageId, userId, (err, result) => {
    if (err) return res.status(500).json({ status: 500, error: err.message || String(err) });

    // result enthält: liked, likes, dislikedByUser, dislikes
    res.status(200).json({ status: 200, ...result });
  });
});

// Dislike-Toggle
router.get('/dislike/:messageId/by/:userId', [security.checkToken, security.authenticate], (req, res) => {
  const messageId = Number(req.params.messageId);
  const userId = String(req.params.userId);
  if (!Number.isInteger(messageId) || !userId) {
    return res.status(400).json({ status: 400, error: 'Invalid messageId or userId' });
  }

  tableDislike.toggleDislike(req.database.db, messageId, userId, (err, result) => {
    if (err) return res.status(500).json({ status: 500, error: err.message || String(err) });

    // result enthält: disliked, dislikes, likedByUser, likes
    res.status(200).json({ status: 200, ...result });
  });
});

router.get('/countview/:messageId', [security.checkToken], function (req, res) {
  let response = { 'status': 0 };
  tableMessage.countView(req.database.db, req.params.messageId, function (err, row) {
    if (err) {
      response.status = 500;
      response.error = err;
    } else {
      response.status = 200;
    }
    res.status(response.status).json(response);
  });
});

router.get('/countcomment/:parentMessageId', [security.checkToken], function (req, res) {
  let response = { 'status': 0 };
  tableMessage.countComment(req.database.db, req.params.parentMessageId, function (err, row) {
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