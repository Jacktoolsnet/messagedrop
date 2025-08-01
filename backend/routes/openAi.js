const express = require('express');
const router = express.Router();
const security = require('../middleware/security');
const bodyParser = require('body-parser');
const OpenAI = require('openai')
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post('/moderate', [security.checkToken, security.authenticate, bodyParser.json({ type: 'application/json' })], function (req, res) {
  openai.moderations.create({
    model: "omni-moderation-latest",
    input: req.body.message.replace(/\'/g, "''"),
  }).then(moderation => {
    res.status(200).json(moderation);
  }).catch(err => {
    res.status(500).json({ 'err': err });
  });
});

module.exports = router