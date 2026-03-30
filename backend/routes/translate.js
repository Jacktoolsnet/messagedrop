const express = require('express');
const router = express.Router();
const security = require('../middleware/security');
const deepl = require('deepl-node');
const metric = require('../middleware/metric');
const { apiError } = require('../middleware/api-error');
const tableMessageTranslation = require('../db/tableMessageTranslation');

const systemAuthKey = typeof process.env.DEEPL_API_KEY === 'string'
  ? process.env.DEEPL_API_KEY.trim()
  : '';
const systemTranslator = systemAuthKey ? new deepl.Translator(systemAuthKey) : null;
const translateMetric = metric.count('translate', { when: 'always', timezone: 'utc', amount: 1 });

function normalizeTargetLanguage(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const normalized = raw.replace('_', '-').toUpperCase();
  if (normalized === 'EN') {
    return 'EN-GB';
  }
  return normalized;
}

function normalizeAuthKey(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw || null;
}

function extractTranslationRequest(req) {
  if (req.method === 'POST') {
    return {
      language: req.body?.language,
      value: req.body?.value,
      messageUuid: req.body?.messageUuid,
      deeplApiKey: req.body?.deeplApiKey
    };
  }

  return {
    language: req.params.language,
    value: req.params.value,
    messageUuid: req.query?.messageUuid,
    deeplApiKey: null
  };
}

function resolveTranslator(customAuthKey) {
  if (customAuthKey) {
    return new deepl.Translator(customAuthKey);
  }
  return systemTranslator;
}

function mapTranslateError(error, usingCustomAuthKey) {
  if (usingCustomAuthKey && error instanceof deepl.AuthorizationError) {
    return apiError.badRequest('user_deepl_auth_failed');
  }
  if (usingCustomAuthKey && error instanceof deepl.QuotaExceededError) {
    return apiError.badRequest('user_deepl_quota_exceeded');
  }
  if (error instanceof deepl.TooManyRequestsError) {
    return apiError.rateLimit('translate_failed_rate_limited');
  }
  return null;
}

function readCachedTranslation(db, messageUuid, targetLang, sourceText) {
  return new Promise((resolve, reject) => {
    tableMessageTranslation.getByMessageAndLanguage(db, messageUuid, targetLang, sourceText, (err, row) => {
      if (err) {
        return reject(err);
      }
      resolve(row);
    });
  });
}

async function handleValidateKey(req, res, next) {
  const customAuthKey = normalizeAuthKey(req.body?.deeplApiKey);
  if (!customAuthKey) {
    return next(apiError.badRequest('user_deepl_auth_required'));
  }

  const translator = resolveTranslator(customAuthKey);
  try {
    const usage = await translator.getUsage();
    return res.status(200).json({
      status: 200,
      result: {
        valid: true,
        quotaReached: usage?.anyLimitReached?.() ?? false,
        characterCount: usage?.character?.count ?? null,
        characterLimit: usage?.character?.limit ?? null
      }
    });
  } catch (error) {
    const apiErr = mapTranslateError(error, true) ?? apiError.internal('translate_key_validation_failed');
    apiErr.detail = error?.message || error;
    return next(apiErr);
  }
}

async function handleTranslate(req, res, next) {
  const response = { status: 0 };
  const request = extractTranslationRequest(req);
  const targetLang = normalizeTargetLanguage(request.language);
  if (!targetLang) {
    return next(apiError.badRequest('invalid_language'));
  }

  const text = typeof request.value === 'string' ? request.value : '';
  if (!text.trim()) {
    return next(apiError.badRequest('translate_value_required'));
  }

  const customAuthKey = normalizeAuthKey(request.deeplApiKey);
  const usingCustomAuthKey = Boolean(customAuthKey);
  const translator = resolveTranslator(customAuthKey);
  if (!translator) {
    return next(apiError.serviceUnavailable('translate_unavailable'));
  }

  const db = req.database?.db;
  const messageUuid = typeof request.messageUuid === 'string' ? request.messageUuid.trim() : '';
  const canReadSharedCache = !!(db && messageUuid && !usingCustomAuthKey);
  const canWriteSharedCache = !!(db && messageUuid && !usingCustomAuthKey);

  if (canReadSharedCache) {
    try {
      const cached = await readCachedTranslation(db, messageUuid, targetLang, text);
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

    if (canWriteSharedCache) {
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

    return res.status(200).json(response);
  } catch (error) {
    const apiErr = mapTranslateError(error, usingCustomAuthKey) ?? apiError.internal('translate_failed');
    apiErr.detail = error?.message || error;
    return next(apiErr);
  }
}

router.get(
  '/:language/:value',
  [
    security.authenticateOptional,
    translateMetric
  ],
  handleTranslate
);

router.post(
  '/',
  [
    security.authenticateOptional,
    express.json({ type: 'application/json', limit: '32kb' }),
    translateMetric
  ],
  handleTranslate
);

router.post(
  '/validate',
  [
    security.authenticateOptional,
    express.json({ type: 'application/json', limit: '8kb' })
  ],
  handleValidateKey
);

module.exports = router;
