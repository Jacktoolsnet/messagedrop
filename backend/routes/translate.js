const express = require('express');
const router = express.Router();
const security = require('../middleware/security');
const deepl = require('deepl-node');
const metric = require('../middleware/metric');
const { apiError } = require('../middleware/api-error');

const translator = new deepl.Translator(process.env.DEEPL_API_KEY);

function normalizeTargetLanguage(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const normalized = raw.replace('_', '-').toUpperCase();
    if (normalized === 'EN') {
        return 'EN-GB';
    }
    return normalized;
}

router.get('/:language/:value',
    [
        security.authenticateOptional,
        metric.count('translate', { when: 'always', timezone: 'utc', amount: 1 })
    ], function (req, res, next) {
        let response = { 'status': 0 };
        const targetLang = normalizeTargetLanguage(req.params.language);
        if (!targetLang) {
            return next(apiError.badRequest('invalid_language'));
        }
        translator
            .translateText(req.params.value, null, targetLang)
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
