const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const { requireAdminJwt, requireRole, requireRoleIfAdmin, requireServiceOrAdminJwt } = require('../middleware/security');
const { signServiceJwt } = require('../utils/serviceJwt');
const tableModerationRequest = require('../db/tableModerationRequest');
const tableModerationState = require('../db/tableModerationState');
const tableModerationVoluntaryReview = require('../db/tableModerationVoluntaryReview');
const { formatExcerpt, sendPushbulletNotification } = require('../utils/pushbullet');
const { apiError } = require('../middleware/api-error');

const router = express.Router();

router.use(express.json({ limit: '256kb' }));

router.use(requireServiceOrAdminJwt);
router.use(requireRoleIfAdmin('moderator', 'legal', 'admin', 'root'));

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

async function requestToBackend(method, path, payload) {
    const base = resolveBackendBase();
    if (!base) {
        throw new Error('backend_unavailable');
    }
    const backendAudience = process.env.SERVICE_JWT_AUDIENCE_BACKEND || 'service.backend';
    const serviceToken = await signServiceJwt({ audience: backendAudience });
    return axios.request({
        method,
        url: `${base}${path}`,
        data: payload,
        headers: {
            Authorization: `Bearer ${serviceToken}`,
            Accept: 'application/json',
            'content-type': 'application/json'
        },
        timeout: 5000,
        validateStatus: () => true
    });
}

async function postToBackend(path, payload) {
    return requestToBackend('post', path, payload);
}

async function getVoluntaryState(db) {
    return new Promise((resolve, reject) => {
        tableModerationState.get(db, tableModerationState.keys.VOLUNTARY, (err, row) => {
            if (err) {
                return reject(err);
            }
            resolve(row || {
                key: tableModerationState.keys.VOLUNTARY,
                lastSeenAt: 0,
                updatedAt: 0,
                updatedBy: null
            });
        });
    });
}

function saveVoluntaryState(db, lastSeenAt, updatedBy) {
    return new Promise((resolve, reject) => {
        tableModerationState.upsert(db, tableModerationState.keys.VOLUNTARY, {
            lastSeenAt,
            updatedAt: Date.now(),
            updatedBy
        }, (err, row) => {
            if (err) {
                return reject(err);
            }
            resolve(row);
        });
    });
}

function getReviewedVoluntaryUuidSet(db, uuids) {
    return new Promise((resolve, reject) => {
        tableModerationVoluntaryReview.listReviewedUuids(db, uuids, (err, rows) => {
            if (err) {
                return reject(err);
            }
            resolve(new Set(rows || []));
        });
    });
}

function saveVoluntaryReview(db, messageUuid, decision, reviewedBy) {
    return new Promise((resolve, reject) => {
        tableModerationVoluntaryReview.upsert(db, {
            messageUuid,
            decision,
            reviewedAt: Date.now(),
            reviewedBy
        }, (err, row) => {
            if (err) {
                return reject(err);
            }
            resolve(row);
        });
    });
}

function toVoluntaryModerationRequest(row) {
    const uuid = normalizeString(row?.uuid);
    return {
        id: uuid,
        messageId: row?.id ?? null,
        messageUuid: uuid,
        messageUserId: normalizeString(row?.userId) || '',
        messageText: normalizeString(row?.message) || '',
        messageType: normalizeString(row?.typ),
        messageCreatedAt: Number(row?.createDateTime || 0),
        latitude: row?.latitude ?? null,
        longitude: row?.longitude ?? null,
        plusCode: normalizeString(row?.plusCode),
        markerType: normalizeString(row?.markerType),
        style: normalizeString(row?.style),
        likes: row?.likes ?? 0,
        dislikes: row?.dislikes ?? 0,
        commentsNumber: row?.commentsNumber ?? 0,
        multimedia: row?.multimedia ?? null,
        hashtags: row?.hashtags ?? '',
        aiScore: row?.aiModerationScore ?? null,
        aiFlagged: row?.aiModerationFlagged ?? null,
        aiDecision: normalizeString(row?.aiModerationDecision),
        aiResponse: row?.aiModeration ?? null,
        patternMatch: row?.patternMatch ?? null,
        patternMatchAt: row?.patternMatchAt ?? null,
        status: 'voluntary',
        createdAt: Number(row?.createDateTime || 0),
        source: 'voluntary'
    };
}

async function fetchPublicMessage(messageUuid) {
    const response = await requestToBackend('get', `/message/internal/uuid/${encodeURIComponent(messageUuid)}`);
    if (response.status === 404) {
        return null;
    }
    if (response.status < 200 || response.status >= 300 || !response.data?.message) {
        const err = apiError.badGateway('backend_request_failed');
        err.detail = response.data?.error || response.data?.message || response.statusText || 'public_message_lookup_failed';
        throw err;
    }
    return response.data.message;
}

async function applyMessageDecision(messageUuid, decision, reason, adminId) {
    const response = await postToBackend('/moderation/decision', {
        messageId: messageUuid,
        decision,
        reason,
        adminId
    });
    if (response.status < 200 || response.status >= 300) {
        const err = apiError.badGateway('moderation_update_failed');
        err.detail = response.data?.error || response.data?.message || response.statusText;
        throw err;
    }
    return true;
}

async function notifyModerationRejection(message, reason, logger) {
    const messageUserId = normalizeString(message?.userId);
    const messageUuid = normalizeString(message?.uuid);
    if (!messageUserId) {
        return false;
    }
    const messageBody = `Your post is no longer publicly visible because it violates our Terms of Use: ${reason}.`;
    try {
        const resp = await postToBackend('/notification/create', {
            userId: messageUserId,
            title: 'Content moderation decision',
            body: messageBody,
            category: 'moderation',
            source: 'admin',
            metadata: {
                reason,
                messageUuid
            }
        });
        if (resp.status < 200 || resp.status >= 300) {
            logger?.warn?.('System notification failed', { status: resp.status, data: resp.data });
            return false;
        }
        return true;
    } catch (error) {
        logger?.warn?.('System notification failed', { error: error?.message || error });
        return false;
    }
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

    tableModerationRequest.list(db, { status, limit, offset }, async (err, rows) => {
        if (err) {
            req.logger?.error?.('Moderation request list failed', { error: err.message });
            return next(apiError.internal('db_error'));
        }
        const enrichedRows = await Promise.all((rows || []).map(async (row) => {
            try {
                const message = await fetchPublicMessage(row.messageUuid);
                return {
                    ...row,
                    likes: message?.likes ?? 0,
                    dislikes: message?.dislikes ?? 0,
                    commentsNumber: message?.commentsNumber ?? 0,
                    multimedia: message?.multimedia ?? null,
                    hashtags: message?.hashtags ?? '',
                    status: row.status
                };
            } catch {
                return row;
            }
        }));
        res.json({ rows: enrichedRows });
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

router.get('/voluntary', async (req, res, next) => {
    const db = req.database?.db;
    if (!db) return next(apiError.internal('database_unavailable'));

    try {
        const state = await getVoluntaryState(db);
        const since = Math.max(0, Number(state.lastSeenAt || 0));
        const limit = Number.isFinite(Number(req.query?.limit)) ? Number(req.query.limit) : 500;
        const response = await requestToBackend(
            'get',
            `/message/internal/moderation-candidates?since=${encodeURIComponent(String(since))}&limit=${encodeURIComponent(String(limit))}`
        );
        if (response.status < 200 || response.status >= 300) {
            const err = apiError.badGateway('moderation_candidates_failed');
            err.detail = response.data?.error || response.data?.message || response.statusText;
            throw err;
        }

        const rawRows = Array.isArray(response.data?.rows)
            ? response.data.rows.map(toVoluntaryModerationRequest).filter((row) => !!row.messageUuid)
            : [];
        const reviewedUuids = await getReviewedVoluntaryUuidSet(db, rawRows.map((row) => row.messageUuid));
        const rows = rawRows.filter((row) => !reviewedUuids.has(row.messageUuid));

        res.json({
            rows,
            state: {
                lastSeenAt: since,
                updatedAt: Number(state.updatedAt || 0),
                updatedBy: state.updatedBy || null
            }
        });
    } catch (error) {
        return next(error?.status ? error : apiError.internal('voluntary_moderation_failed'));
    }
});

router.post('/voluntary/finish', async (req, res, next) => {
    const db = req.database?.db;
    if (!db) return next(apiError.internal('database_unavailable'));

    try {
        const current = await getVoluntaryState(db);
        const requestedLastSeenAt = Number.isFinite(Number(req.body?.lastSeenAt))
            ? Math.max(0, Number(req.body.lastSeenAt))
            : 0;
        const lastSeenAt = Math.max(Number(current.lastSeenAt || 0), requestedLastSeenAt);
        const state = await saveVoluntaryState(db, lastSeenAt, req.admin?.sub || req.service?.sub || null);
        res.json({
            finished: true,
            state: {
                lastSeenAt: Number(state.lastSeenAt || 0),
                updatedAt: Number(state.updatedAt || 0),
                updatedBy: state.updatedBy || null
            }
        });
    } catch (error) {
        return next(error?.status ? error : apiError.internal('voluntary_moderation_finish_failed'));
    }
});

router.post('/messages/:messageUuid/approve', requireAdminJwt, requireRole(), async (req, res, next) => {
    try {
        const messageUuid = normalizeString(req.params.messageUuid);
        if (!messageUuid) {
            return next(apiError.badRequest('message_id_required'));
        }
        await applyMessageDecision(messageUuid, 'approved', null, req.admin?.sub || null);
        await saveVoluntaryReview(req.database.db, messageUuid, 'approved', req.admin?.sub || null);
        res.json({ approved: true });
    } catch (error) {
        return next(error?.status ? error : apiError.badGateway('moderation_update_failed'));
    }
});

router.post('/messages/:messageUuid/reject', requireAdminJwt, requireRole(), async (req, res, next) => {
    try {
        const messageUuid = normalizeString(req.params.messageUuid);
        const reason = normalizeString(req.body?.reason);
        if (!messageUuid) {
            return next(apiError.badRequest('message_id_required'));
        }
        if (!reason) {
            return next(apiError.badRequest('reason_required'));
        }

        const message = await fetchPublicMessage(messageUuid);
        if (!message) {
            return next(apiError.notFound('message_not_found'));
        }
        await applyMessageDecision(messageUuid, 'rejected', reason, req.admin?.sub || null);
        await saveVoluntaryReview(req.database.db, messageUuid, 'rejected', req.admin?.sub || null);
        await notifyModerationRejection(message, reason, req.logger);
        res.json({ rejected: true });
    } catch (error) {
        return next(error?.status ? error : apiError.badGateway('moderation_update_failed'));
    }
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
