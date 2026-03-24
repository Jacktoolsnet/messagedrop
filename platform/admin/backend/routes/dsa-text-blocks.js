const express = require('express');
const crypto = require('crypto');
const { requireAdminJwt, requireRole } = require('../middleware/security');
const { apiError } = require('../middleware/api-error');
const tableDsaTextBlock = require('../db/tableDsaTextBlock');
const { translateFieldsWithFallback } = require('../utils/deeplTranslator');

const router = express.Router();
router.use(requireAdminJwt, requireRole('moderator', 'legal', 'admin', 'root'));

const VALID_DECISION_OUTCOMES = ['NO_ACTION', 'REMOVE_CONTENT', 'RESTRICT', 'FORWARD_TO_AUTHORITY'];

function db(req) {
    return req.database?.db;
}

function normalizeString(value, fallback = '') {
    return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeInteger(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function normalizeBoolean(value, fallback = true) {
    if (typeof value === 'boolean') {
        return value;
    }
    if (value === 1 || value === '1' || value === 'true') {
        return true;
    }
    if (value === 0 || value === '0' || value === 'false') {
        return false;
    }
    return fallback;
}

function slugify(value) {
    const normalized = normalizeString(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_{2,}/g, '_');
    return normalized || `text_block_${crypto.randomUUID().slice(0, 8)}`;
}

function isValidType(value) {
    return Object.values(tableDsaTextBlock.textBlockTypes).includes(value);
}

function normalizeDecisionOutcomes(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map((entry) => normalizeString(entry))
        .filter((entry, index, arr) => !!entry && VALID_DECISION_OUTCOMES.includes(entry) && arr.indexOf(entry) === index);
}

function validatePayload(body, { partial = false } = {}) {
    const type = normalizeString(body?.type);
    const labelDe = normalizeString(body?.labelDe);
    const labelEn = normalizeString(body?.labelEn);
    const descriptionDe = normalizeString(body?.descriptionDe);
    const descriptionEn = normalizeString(body?.descriptionEn);
    const contentDe = typeof body?.contentDe === 'string' ? body.contentDe.trim() : '';
    const contentEn = typeof body?.contentEn === 'string' ? body.contentEn.trim() : '';
    const decisionOutcomes = normalizeDecisionOutcomes(body?.decisionOutcomes);
    const sortOrder = normalizeInteger(body?.sortOrder, 0);
    const isActive = normalizeBoolean(body?.isActive, true);
    const translatedAt = body?.translatedAt === null || body?.translatedAt === undefined
        ? null
        : normalizeInteger(body?.translatedAt, null);

    if (!partial || Object.prototype.hasOwnProperty.call(body || {}, 'type')) {
        if (!isValidType(type)) {
            throw apiError.badRequest('invalid_text_block_type');
        }
    }

    if (!partial || Object.prototype.hasOwnProperty.call(body || {}, 'labelDe')) {
        if (!labelDe) {
            throw apiError.badRequest('label_de_required');
        }
    }

    const effectiveType = type || normalizeString(body?.existingType);
    if ((!partial || Object.prototype.hasOwnProperty.call(body || {}, 'contentDe'))
        && effectiveType === tableDsaTextBlock.textBlockTypes.REASONING_TEMPLATE
        && !contentDe) {
        throw apiError.badRequest('content_de_required');
    }

    if ((!partial || Object.prototype.hasOwnProperty.call(body || {}, 'decisionOutcomes'))
        && effectiveType === tableDsaTextBlock.textBlockTypes.REASONING_TEMPLATE
        && decisionOutcomes.length === 0) {
        throw apiError.badRequest('decision_outcomes_required');
    }

    const rawKey = normalizeString(body?.key);

    return {
        key: rawKey ? slugify(rawKey) : (partial ? '' : slugify(labelDe)),
        type,
        labelDe,
        labelEn,
        descriptionDe,
        descriptionEn,
        contentDe,
        contentEn,
        decisionOutcomes,
        sortOrder,
        isActive,
        translatedAt
    };
}

function toDto(row) {
    if (!row) {
        return null;
    }

    let decisionOutcomes = [];
    try {
        const parsed = JSON.parse(row.decisionOutcomes || '[]');
        decisionOutcomes = normalizeDecisionOutcomes(parsed);
    } catch (_error) {
        decisionOutcomes = [];
    }

    if (row.type === tableDsaTextBlock.textBlockTypes.REASONING_TEMPLATE && decisionOutcomes.length === 0) {
        decisionOutcomes = [...VALID_DECISION_OUTCOMES];
    }

    return {
        id: row.id,
        key: row.key,
        type: row.type,
        labelDe: row.labelDe || '',
        labelEn: row.labelEn || '',
        descriptionDe: row.descriptionDe || '',
        descriptionEn: row.descriptionEn || '',
        contentDe: row.contentDe || '',
        contentEn: row.contentEn || '',
        decisionOutcomes,
        sortOrder: Number(row.sortOrder || 0),
        isActive: !!row.isActive,
        translatedAt: row.translatedAt == null ? null : Number(row.translatedAt),
        createdAt: Number(row.createdAt || 0),
        updatedAt: Number(row.updatedAt || 0)
    };
}

router.get('/', (req, res, next) => {
    const database = db(req);
    if (!database) {
        return next(apiError.internal('database_unavailable'));
    }

    const type = normalizeString(req.query?.type);
    const query = normalizeString(req.query?.q);
    const activeOnly = typeof req.query?.activeOnly === 'undefined'
        ? undefined
        : normalizeBoolean(req.query.activeOnly, true);

    if (type && !isValidType(type)) {
        return next(apiError.badRequest('invalid_text_block_type'));
    }

    tableDsaTextBlock.list(database, {
        type: type || undefined,
        query: query || undefined,
        activeOnly
    }, (err, rows) => {
        if (err) {
            const apiErr = apiError.internal('db_error');
            apiErr.detail = err.message;
            return next(apiErr);
        }
        res.json((rows || []).map(toDto));
    });
});

router.get('/:id', (req, res, next) => {
    const database = db(req);
    if (!database) {
        return next(apiError.internal('database_unavailable'));
    }

    tableDsaTextBlock.getById(database, req.params.id, (err, row) => {
        if (err) {
            const apiErr = apiError.internal('db_error');
            apiErr.detail = err.message;
            return next(apiErr);
        }
        if (!row) {
            return next(apiError.notFound('text_block_not_found'));
        }
        res.json(toDto(row));
    });
});

router.post('/translate-preview', async (req, res, next) => {
    try {
        const source = {
            labelEn: normalizeString(req.body?.labelDe),
            descriptionEn: normalizeString(req.body?.descriptionDe),
            contentEn: typeof req.body?.contentDe === 'string' ? req.body.contentDe.trim() : ''
        };
        const { translated, usedFallback } = await translateFieldsWithFallback(source, 'EN');
        res.json({
            labelEn: translated.labelEn || '',
            descriptionEn: translated.descriptionEn || '',
            contentEn: translated.contentEn || '',
            translatedAt: Date.now(),
            usedFallback
        });
    } catch (error) {
        const apiErr = error?.status ? error : apiError.internal('translate_failed');
        if (!apiErr.detail) {
            apiErr.detail = error?.message || error;
        }
        next(apiErr);
    }
});

router.post('/', (req, res, next) => {
    const database = db(req);
    if (!database) {
        return next(apiError.internal('database_unavailable'));
    }

    let payload;
    try {
        payload = validatePayload(req.body);
    } catch (error) {
        return next(error);
    }

    tableDsaTextBlock.getByKey(database, payload.key, (lookupErr, existingRow) => {
        if (lookupErr) {
            const apiErr = apiError.internal('db_error');
            apiErr.detail = lookupErr.message;
            return next(apiErr);
        }
        if (existingRow) {
            return next(apiError.conflict('text_block_key_exists'));
        }

        const now = Date.now();
        tableDsaTextBlock.create(database, {
            ...payload,
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now
        }, (err, row) => {
            if (err) {
                const apiErr = apiError.internal('db_error');
                apiErr.detail = err.message;
                return next(apiErr);
            }
            tableDsaTextBlock.getById(database, row.id, (readErr, createdRow) => {
                if (readErr) {
                    const apiErr = apiError.internal('db_error');
                    apiErr.detail = readErr.message;
                    return next(apiErr);
                }
                res.status(201).json(toDto(createdRow));
            });
        });
    });
});

router.patch('/:id', (req, res, next) => {
    const database = db(req);
    if (!database) {
        return next(apiError.internal('database_unavailable'));
    }

    tableDsaTextBlock.getById(database, req.params.id, (lookupErr, existingRow) => {
        if (lookupErr) {
            const apiErr = apiError.internal('db_error');
            apiErr.detail = lookupErr.message;
            return next(apiErr);
        }
        if (!existingRow) {
            return next(apiError.notFound('text_block_not_found'));
        }

        let payload;
        try {
            payload = validatePayload({
                ...req.body,
                existingType: existingRow.type
            }, { partial: true });
        } catch (error) {
            return next(error);
        }

        const germanChanged = [
            normalizeString(req.body?.labelDe, existingRow.labelDe),
            normalizeString(req.body?.descriptionDe, existingRow.descriptionDe),
            typeof req.body?.contentDe === 'string' ? req.body.contentDe.trim() : existingRow.contentDe
        ].some((value, index) => value !== [existingRow.labelDe, existingRow.descriptionDe, existingRow.contentDe][index]);

        const nextFields = {
            ...payload,
            key: payload.key || existingRow.key,
            type: payload.type || existingRow.type,
            updatedAt: Date.now()
        };

        if (germanChanged && !Object.prototype.hasOwnProperty.call(req.body || {}, 'translatedAt')) {
            nextFields.translatedAt = null;
        }

        if (nextFields.key !== existingRow.key) {
            return tableDsaTextBlock.getByKey(database, nextFields.key, (keyErr, keyRow) => {
                if (keyErr) {
                    const apiErr = apiError.internal('db_error');
                    apiErr.detail = keyErr.message;
                    return next(apiErr);
                }
                if (keyRow && keyRow.id !== existingRow.id) {
                    return next(apiError.conflict('text_block_key_exists'));
                }
                persistUpdate(database, existingRow.id, nextFields, res, next);
            });
        }

        return persistUpdate(database, existingRow.id, nextFields, res, next);
    });
});

function persistUpdate(database, id, fields, res, next) {
    tableDsaTextBlock.update(database, id, fields, (err, updated) => {
        if (err) {
            const apiErr = apiError.internal('db_error');
            apiErr.detail = err.message;
            return next(apiErr);
        }
        if (!updated) {
            return next(apiError.notFound('text_block_not_found'));
        }
        tableDsaTextBlock.getById(database, id, (readErr, row) => {
            if (readErr) {
                const apiErr = apiError.internal('db_error');
                apiErr.detail = readErr.message;
                return next(apiErr);
            }
            res.json(toDto(row));
        });
    });
}

router.delete('/:id', (req, res, next) => {
    const database = db(req);
    if (!database) {
        return next(apiError.internal('database_unavailable'));
    }

    tableDsaTextBlock.deleteById(database, req.params.id, (err, deleted) => {
        if (err) {
            const apiErr = apiError.internal('db_error');
            apiErr.detail = err.message;
            return next(apiErr);
        }
        if (!deleted) {
            return next(apiError.notFound('text_block_not_found'));
        }
        res.json({ deleted: true });
    });
});

module.exports = router;
