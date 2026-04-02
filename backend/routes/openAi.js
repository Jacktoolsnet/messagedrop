const express = require('express');
const router = express.Router();
const security = require('../middleware/security');
const OpenAI = require('openai')
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY_MODERATION });
const moderationModel = process.env.OPENAI_MODERATION_MODEL || 'omni-moderation-latest';
const metric = require('../middleware/metric');
const { createOpenAiApiError } = require('../utils/openai-error');

router.post('/moderate',
  [
    security.authenticate,
    express.json({ type: 'application/json' }),
    metric.count('openai.moderate', { when: 'always', timezone: 'utc', amount: 1 })
  ]
  , function (req, res, next) {
    openai.moderations.create({
      model: moderationModel,
      input: req.body.message.replace(/'/g, "''"),
    }).then(moderation => {
      res.status(200).json(moderation);
    }).catch(err => {
      next(createOpenAiApiError(err, {
        message: 'openai_failed',
        operation: 'moderations.create',
        model: moderationModel
      }));
    });
  });

module.exports = router
