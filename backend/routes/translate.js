const express = require('express');
const router = express.Router();
const security = require('../middleware/security');
const deepl = require('deepl-node');
const metric = require('../middleware/metric');
const { apiError } = require('../middleware/api-error');

const translator = new deepl.Translator(process.env.DEEPL_API_KEY);

router.get('/:language/:value',
    [
        security.authenticate,
        metric.count('translate', { when: 'always', timezone: 'utc', amount: 1 })
    ], function (req, res, next) {
        let response = { 'status': 0 };
        translator
            .translateText(req.params.value, null, req.params.language)
            .then((result) => {
                response.status = 200;
                response.result = result;
                res.status(response.status).json(response);
            })
            .catch((error) => {
                const apiErr = apiError.internal('translate_failed');
                apiErr.detail = error?.message || error;
                next(apiErr);
            });
    });

module.exports = router
