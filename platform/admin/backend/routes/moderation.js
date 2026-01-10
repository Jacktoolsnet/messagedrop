const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const { requireAdminJwt, requireRole, checkToken } = require('../middleware/security');
const { verifyServiceJwt, signServiceJwt } = require('../utils/serviceJwt');
const tableModerationRequest = require('../db/tableModerationRequest');
const { formatExcerpt, sendPushbulletNotification } = require('../utils/pushbullet');
const { apiError } = require('../middleware/api-error');

const router = express.Router();

router.use(express.json({ limit: '256kb' }));

router.use((req, res, next) => {
    if (req.token) {
        try {
            verifyServiceJwt(req.token);
            return next();
        } catch {
            return requireAdminJwt(req, res, next);
        }
    }
    return checkToken(req, res, next);
});

function normalizeBool(value) {
    if (value === undefined || value === null) return null;
    return value ? 1 : 0;
}

function normalizeString(value) {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text.length ? text : null;
}

function resolveBackendBase() {
    const base = (process.env.BASE_URL || '').replace(/\/+$/, '');
    if (!base) return null;
    return process.env.PORT ? `${base}:${process.env.PORT}` : base;
}

async function postToBackend(path, payload) {
    const base = resolveBackendBase();
    if (!base) {
        throw new Error('backend_unavailable');
    }
    const backendAudience = process.env.SERVICE_JWT_AUDIENCE_BACKEND || 'service.backend';
    const serviceToken = await signServiceJwt({ audience: backendAudience });
    return axios.post(`${base}${path}`, payload, {
        headers: {
            Authorization: `Bearer ${serviceToken}`,
            Accept: 'application/json',
            'content-type': 'application/json'
        },
        timeout: 5000,
        validateStatus: () => true
    });
}

router.post('/requests', (req, res, next) => {
    const db = req.database?.db;
    if (!db) return next(apiError.internal('database_unavailable'));

    const messageUuid = normalizeString(req.body?.messageUuid);
    const messageUserId = normalizeString(req.body?.messageUserId);
    const messageText = normalizeString(req.body?.messageText);

    if (!messageUuid || !messageUserId || !messageText) {
        return next(apiError.badRequest('missing_fields'));
    }

    const id = crypto.randomUUID();
    const payload = {
        id,
        messageId: req.body?.messageId ?? null,
        messageUuid,
        messageUserId,
        messageText,
        messageType: normalizeString(req.body?.messageType),
        messageCreatedAt: req.body?.messageCreatedAt ?? null,
        latitude: req.body?.latitude ?? null,
        longitude: req.body?.longitude ?? null,
        plusCode: normalizeString(req.body?.plusCode),
        markerType: normalizeString(req.body?.markerType),
        style: normalizeString(req.body?.style),
        aiScore: req.body?.aiScore ?? null,
        aiFlagged: normalizeBool(req.body?.aiFlagged),
        aiDecision: normalizeString(req.body?.aiDecision),
        aiResponse: req.body?.aiResponse
            ? (typeof req.body.aiResponse === 'string' ? req.body.aiResponse : JSON.stringify(req.body.aiResponse))
            : null,
        patternMatch: normalizeBool(req.body?.patternMatch),
        patternMatchAt: req.body?.patternMatchAt ?? null,
        status: tableModerationRequest.statusValues.PENDING,
        createdAt: Date.now()
    };

    tableModerationRequest.create(db, payload, (err) => {
        if (err) {
            req.logger?.error?.('Moderation request insert failed', { error: err.message });
            return next(apiError.internal('db_error'));
        }
        const title = 'Moderation request';
        const body = [
            `User: ${messageUserId}`,
            `UUID: ${messageUuid}`,
            `Type: ${payload.messageType || 'unknown'}`,
            `Excerpt: ${formatExcerpt(messageText)}`
        ].join('\n');
        void sendPushbulletNotification({ title, body, logger: req.logger });
        res.status(201).json({ id });
    });
});

router.get('/requests', (req, res, next) => {
    const db = req.database?.db;
    if (!db) return next(apiError.internal('database_unavailable'));

    const status = normalizeString(req.query?.status) || tableModerationRequest.statusValues.PENDING;
    const limit = Number.isFinite(Number(req.query?.limit)) ? Number(req.query.limit) : 200;
    const offset = Number.isFinite(Number(req.query?.offset)) ? Number(req.query.offset) : 0;

    tableModerationRequest.list(db, { status, limit, offset }, (err, rows) => {
        if (err) {
            req.logger?.error?.('Moderation request list failed', { error: err.message });
            return next(apiError.internal('db_error'));
        }
        res.json({ rows });
    });
});

router.get('/requests/count', (req, res, next) => {
    const db = req.database?.db;
    if (!db) return next(apiError.internal('database_unavailable'));

    const status = normalizeString(req.query?.status) || tableModerationRequest.statusValues.PENDING;
    tableModerationRequest.count(db, status, (err, count) => {
        if (err) {
            req.logger?.error?.('Moderation request count failed', { error: err.message });
            return next(apiError.internal('db_error'));
        }
        res.json({ count });
    });
});

router.get('/requests/:id', (req, res, next) => {
    const db = req.database?.db;
    if (!db) return next(apiError.internal('database_unavailable'));

    tableModerationRequest.getById(db, String(req.params.id), (err, row) => {
        if (err) {
            return next(apiError.internal('db_error'));
        }
        if (!row) {
            return next(apiError.notFound('not_found'));
        }
        res.json({ request: row });
    });
});

router.post('/requests/:id/approve', requireAdminJwt, requireRole(), (req, res, next) => {
    const db = req.database?.db;
    if (!db) return next(apiError.internal('database_unavailable'));

    const requestId = String(req.params.id);
    tableModerationRequest.getById(db, requestId, async (err, row) => {
        if (err) return next(apiError.internal('db_error'));
        if (!row) return next(apiError.notFound('not_found'));

        try {
            const resp = await postToBackend('/moderation/decision', {
                messageId: row.messageUuid,
                decision: 'approved',
                reason: null,
                adminId: req.admin?.sub || null
            });
            if (resp.status < 200 || resp.status >= 300) {
                return next(apiError.badGateway('moderation_update_failed'));
            }
        } catch (error) {
            const apiErr = apiError.badGateway('moderation_update_failed');
            apiErr.detail = error?.message || error;
            return next(apiErr);
        }

        tableModerationRequest.deleteById(db, requestId, (deleteErr) => {
            if (deleteErr) {
                return next(apiError.internal('db_error'));
            }
            res.json({ approved: true });
        });
    });
});

router.post('/requests/:id/reject', requireAdminJwt, requireRole(), async (req, res, next) => {
    const db = req.database?.db;
    if (!db) return next(apiError.internal('database_unavailable'));

    const requestId = String(req.params.id);
    const reason = normalizeString(req.body?.reason);
    if (!reason) {
        return next(apiError.badRequest('reason_required'));
    }

    tableModerationRequest.getById(db, requestId, async (err, row) => {
        if (err) return next(apiError.internal('db_error'));
        if (!row) return next(apiError.notFound('not_found'));

        try {
            const resp = await postToBackend('/moderation/decision', {
                messageId: row.messageUuid,
                decision: 'rejected',
                reason,
                adminId: req.admin?.sub || null
            });
            if (resp.status < 200 || resp.status >= 300) {
                return next(apiError.badGateway('moderation_update_failed'));
            }
        } catch (error) {
            const apiErr = apiError.badGateway('moderation_update_failed');
            apiErr.detail = error?.message || error;
            return next(apiErr);
        }

        const messageBody = `Your post is no longer publicly visible because it violates our Terms of Use: ${reason}.`;
        try {
            const resp = await postToBackend('/notification/create', {
                userId: row.messageUserId,
                title: 'Content moderation decision',
                body: messageBody,
                category: 'moderation',
                source: 'admin',
                metadata: {
                    reason,
                    messageUuid: row.messageUuid
                }
            });
            if (resp.status < 200 || resp.status >= 300) {
                req.logger?.warn?.('System notification failed', { status: resp.status, data: resp.data });
            }
        } catch (error) {
            req.logger?.warn?.('System notification failed', { error: error?.message || error });
        }

        tableModerationRequest.updateResolution(
            db,
            requestId,
            tableModerationRequest.statusValues.REJECTED,
            Date.now(),
            req.admin?.sub || null,
            reason,
            (updateErr) => {
                if (updateErr) {
                    return next(apiError.internal('db_error'));
                }
                res.json({ rejected: true });
            }
        );
    });
});

module.exports = router;
