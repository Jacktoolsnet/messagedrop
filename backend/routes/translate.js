const express = require('express');
const router = express.Router();
const security = require('../middleware/security');
const deepl = require('deepl-node');

translator = new deepl.Translator(process.env.DEEPL_API_KEY);

router.get('/:language/:value', [security.checkToken], function(req, res) {
  let response = {'status' : 0};
  this.translator
    .translateText(req.params.value, null, req.params.language)
    .then((result) => {
        response.status = 200;
        response.result = result;
        res.setHeader('Content-Type', 'application/json');      
        res.status(response.status);
        res.json(response);
    })
    .catch((error) => {
        response.status = 500;
        response.error = error.message;
        res.setHeader('Content-Type', 'application/json');      
        res.status(response.status);
        res.json(response);
    });
});

module.exports = router