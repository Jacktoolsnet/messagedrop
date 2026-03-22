const express = require('express');
const router = express.Router();
const deepl = require('deepl-node');
const { requireAdminJwt } = require('../middleware/security');
const { apiError } = require('../middleware/api-error');

function getTranslator() {
    const authKey = typeof process.env.DEEPL_API_KEY === 'string'
        ? process.env.DEEPL_API_KEY.trim()
        : '';

    if (!authKey) {
        throw apiError.serviceUnavailable('deepl_not_configured');
    }

    return new deepl.Translator(authKey);
}

router.use(requireAdminJwt);

router.get('/:language/:value', function (req, res, next) {
    let response = { 'status': 0 };
    let translator;
    try {
        translator = getTranslator();
    } catch (error) {
        return next(error);
    }

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
