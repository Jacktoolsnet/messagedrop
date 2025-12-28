const express = require('express');
const router = express.Router();
const security = require('../middleware/security');
const OpenAI = require('openai')
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const metric = require('../middleware/metric');
const { apiError } = require('../middleware/api-error');

router.post('/moderate',
  [
    security.authenticate,
    express.json({ type: 'application/json' }),
    metric.count('openai.moderate', { when: 'always', timezone: 'utc', amount: 1 })
  ]
  , function (req, res, next) {
    openai.moderations.create({
      model: "omni-moderation-latest",
      input: req.body.message.replace(/'/g, "''"),
    }).then(moderation => {
      res.status(200).json(moderation);
    }).catch(err => {
      const apiErr = apiError.internal('openai_failed');
      apiErr.detail = err?.message || err;
      next(apiErr);
    });
  });

module.exports = router
