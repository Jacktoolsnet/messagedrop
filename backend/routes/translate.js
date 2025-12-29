const express = require('express');
const router = express.Router();
const security = require('../middleware/security');
const deepl = require('deepl-node');
const metric = require('../middleware/metric');
const { apiError } = require('../middleware/api-error');
const tableMessageTranslation = require('../db/tableMessageTranslation');

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
    ], async function (req, res, next) {
        let response = { status: 0 };
        const targetLang = normalizeTargetLanguage(req.params.language);
        if (!targetLang) {
            return next(apiError.badRequest('invalid_language'));
        }

        const text = String(req.params.value ?? '');
        const db = req.database?.db;
        const messageUuid = typeof req.query?.messageUuid === 'string' ? req.query.messageUuid.trim() : '';

        if (db && messageUuid) {
            try {
                const cached = await new Promise((resolve, reject) => {
                    tableMessageTranslation.getByMessageAndLanguage(db, messageUuid, targetLang, text, (err, row) => {
                        if (err) {
                            return reject(err);
                        }
                        resolve(row);
                    });
                });
                if (cached) {
                    response.status = 200;
                    response.result = {
                        text: cached.translatedText,
                        detectedSourceLang: cached.detectedSourceLang || ''
                    };
                    return res.status(200).json(response);
                }
            } catch (err) {
                req.logger?.warn?.('Translation cache read failed', { error: err?.message || err });
            }
        }

        try {
            const result = await translator.translateText(text, null, targetLang);
            response.status = 200;
            response.result = result;
            if (db && messageUuid) {
                tableMessageTranslation.upsert(
                    db,
                    messageUuid,
                    targetLang,
                    text,
                    result?.text || '',
                    result?.detectedSourceLang || null,
                    (err) => {
                        if (err) {
                            req.logger?.warn?.('Translation cache write failed', { error: err?.message || err });
                        }
                    }
                );
            }
            res.status(200).json(response);
        } catch (error) {
            const apiErr = apiError.internal('translate_failed');
            apiErr.detail = error?.message || error;
            next(apiErr);
        }
    });

module.exports = router
