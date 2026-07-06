const express = require('express');
const axios = require('axios');
const security = require('../middleware/security');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const FormData = require('form-data');
const tableMessage = require('../db/tableMessage');
const tableSecretDrop = require('../db/tableSecretDrop');
const { signServiceJwt } = require('../utils/serviceJwt');
const { createPowGuard } = require('../middleware/pow');
const { apiError } = require('../middleware/api-error');
const { resolveBaseUrl } = require('../utils/adminLogForwarder');

const router = express.Router();

router.use(express.json({ limit: '1mb' }));

const maxEvidenceFileMb = Number(process.env.DSA_EVIDENCE_MAX_FILE_MB || 1);
const maxEvidenceFileBytes = Math.max(1, maxEvidenceFileMb) * 1024 * 1024;
const upload = multer({ limits: { fileSize: maxEvidenceFileBytes } });

const rateLimitMessage = (message) => ({
    errorCode: 'RATE_LIMIT',
    message,
    error: message
});

/* -------------------------------- Rate Limits ------------------------------- */
const signalLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 150,
    standardHeaders: true,
    legacyHeaders: false,
    message: rateLimitMessage('Too many DSA report requests. Please try again later.')
});

const noticeLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 90,
    standardHeaders: true,
    legacyHeaders: false,
    message: rateLimitMessage('Too many DSA notice requests. Please try again later.')
});

const evidenceLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: rateLimitMessage('Too many evidence uploads. Please try again later.')
});

const moderationToggleLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: rateLimitMessage('Too many moderation toggle requests. Please try again later.')
});

const reportsPerHour = Math.max(1, Number(process.env.DSA_REPORTS_PER_IP_PER_HOUR || 1));
const reportHourlyLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: reportsPerHour,
    standardHeaders: true,
    legacyHeaders: false,
    message: rateLimitMessage('Too many DSA reports, please try again later.')
});

const ADMIN_AUDIENCE = process.env.SERVICE_JWT_AUDIENCE_ADMIN || 'service.admin-backend';
const adminBaseUrl = resolveBaseUrl(process.env.ADMIN_BASE_URL, process.env.ADMIN_PORT);

const noticePow = createPowGuard({
    scope: 'dsa.notice',
    threshold: 6,
    suspiciousThreshold: 3
});

const noticeEvidencePow = createPowGuard({
    scope: 'dsa.notice.evidence',
    threshold: 5,
    suspiciousThreshold: 3,
    difficulty: Number(process.env.POW_EVIDENCE_DIFFICULTY || process.env.POW_DIFFICULTY || 12)
});

const statusEvidencePow = createPowGuard({
    scope: 'dsa.status.evidence',
    threshold: 5,
    suspiciousThreshold: 3,
    difficulty: Number(process.env.POW_EVIDENCE_DIFFICULTY || process.env.POW_DIFFICULTY || 12)
});

function buildForwardError(err) {
    const status = err?.response?.status || 502;
    const apiErr = apiError.fromStatus(status);
    apiErr.detail = err?.response?.data || err?.message || null;
    return apiErr;
}

/* --------------------------------- Helper ---------------------------------- */
function normalizeReportedContentType(value) {
    const normalized = String(value || 'public message').trim().toLowerCase();
    return normalized === 'secret drop' ? 'secret drop' : 'public message';
}

function findMessageByIdOrUuid(db, messageId) {
    return new Promise((resolve, reject) => {
        const raw = String(messageId ?? '').trim();
        if (!raw) return resolve(null);
        const isNumeric = /^\d+$/.test(raw);
        const handler = (err, row) => {
            if (err) return reject(err);
            resolve(row || null);
        };
        if (isNumeric) {
            tableMessage.getById(db, raw, handler);
        } else {
            tableMessage.getByUuid(db, raw, handler);
        }
    });
}


function findSecretDropByIdOrUuid(db, secretDropId) {
    return new Promise((resolve, reject) => {
        const raw = String(secretDropId ?? '').trim();
        if (!raw) return resolve(null);
        const isNumeric = /^\d+$/.test(raw);
        const handler = (row) => resolve(row || null);
        const onError = (err) => reject(err);
        if (isNumeric && typeof tableSecretDrop.getById === 'function') {
            tableSecretDrop.getById(db, raw).then(handler).catch(onError);
        } else {
            tableSecretDrop.getByUuid(db, raw).then(handler).catch(onError);
        }
    });
}

async function ensureContentExists(req, contentId, next) {
    const db = req.database?.db;
    if (!db) {
        next(apiError.internal('database_unavailable'));
        return null;
    }
    const raw = String(contentId ?? '').trim();
    if (!raw) {
        next(apiError.badRequest('contentId is required'));
        return null;
    }
    const reportedContentType = normalizeReportedContentType(req.body?.reportedContentType);
    try {
        const row = reportedContentType === 'secret drop'
            ? await findSecretDropByIdOrUuid(db, raw)
            : await findMessageByIdOrUuid(db, raw);
        if (!row) {
            next(apiError.notFound(reportedContentType === 'secret drop' ? 'secret_drop_not_found' : 'message_not_found'));
            return null;
        }
        return { row, reportedContentType };
    } catch (err) {
        const apiErr = apiError.internal('db_error');
        apiErr.detail = err?.message || err;
        next(apiErr);
        return null;
    }
}

async function forwardPost(path, body) {
    const url = `${adminBaseUrl}/dsa/frontend${path}`;
    const serviceToken = await signServiceJwt({ audience: ADMIN_AUDIENCE });
    const headers = {
        'content-type': 'application/json',
        Authorization: `Bearer ${serviceToken}`,
    };

    const resp = await axios.post(url, body, {
        headers,
        timeout: 5000,
        validateStatus: () => true
    });
    return resp;
}

async function forwardPostBackend(path, body, extraHeaders = {}) {
    const url = `${adminBaseUrl}/dsa/backend${path}`;
    const serviceToken = await signServiceJwt({ audience: ADMIN_AUDIENCE });
    const headers = {
        Authorization: `Bearer ${serviceToken}`,
        ...extraHeaders
    };
    const resp = await axios.post(url, body, {
        headers,
        timeout: 10000,
        validateStatus: () => true,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
    });
    return resp;
}

function disableLocallyIfPossible(req, contentUuid, reportedContentType = 'public message') {
    return new Promise((resolve) => {
        try {
            const db = req.database?.db;
            if (!db || !contentUuid) return resolve(false);

            if (reportedContentType === 'secret drop') {
                tableSecretDrop.disableSecretDrop(db, contentUuid).then(resolve).catch(() => resolve(false));
                return;
            }

            tableMessage.disableMessage(db, contentUuid, (err) => {
                if (err) {
                    return resolve(false);
                }
                resolve(true);
            });
        } catch {
            resolve(false);
        }
    });
}

function setDsaStatusTokenIfPossible(req, contentUuid, token, reportedContentType = 'public message') {
    try {
        const db = req.database?.db;
        if (!db || !contentUuid || !token) return;
        if (reportedContentType === 'secret drop') {
            tableSecretDrop.setDsaStatusToken(db, contentUuid, token, Date.now()).catch(() => { });
            return;
        }
        tableMessage.setDsaStatusToken(db, contentUuid, token, Date.now(), () => { });
    } catch {
        // best effort only
    }
}

/* --------------------------------- Routes ---------------------------------- */

// POST /dsa/signals  -> forward an {ADMIN_BASE_URL[:ADMIN_PORT]}/dsa/frontend/signals
router.post('/signals', signalLimiter, reportHourlyLimiter, async (req, res, next) => {
    try {
        const contentInfo = await ensureContentExists(req, req.body?.contentId, next);
        if (!contentInfo) return;
        const canonicalContentId = String(contentInfo.row.uuid ?? req.body?.contentId ?? '').trim();
        const reportedContentType = contentInfo.reportedContentType;
        if (canonicalContentId) {
            req.body = { ...req.body, contentId: canonicalContentId, reportedContentType };
        }
        const resp = await forwardPost('/signals', req.body);

        if (resp?.status >= 200 && resp?.status < 300 && canonicalContentId && req.database?.db) {
            await disableLocallyIfPossible(req, canonicalContentId, reportedContentType);
        }

        if (resp?.status >= 200 && resp?.status < 300 && resp?.data?.token && canonicalContentId && req.database?.db) {
            setDsaStatusTokenIfPossible(req, canonicalContentId, resp.data.token, reportedContentType);
        }

        res.status(resp.status).json(resp.data);
    } catch (err) {
        return next(buildForwardError(err));
    }
});

// POST /dsa/notices  -> forward an {ADMIN_BASE_URL[:ADMIN_PORT]}/dsa/frontend/notices
router.post('/notices', noticeLimiter, reportHourlyLimiter, noticePow, async (req, res, next) => {
    try {
        const contentInfo = await ensureContentExists(req, req.body?.contentId, next);
        if (!contentInfo) return;
        const canonicalContentId = String(contentInfo.row.uuid ?? req.body?.contentId ?? '').trim();
        const reportedContentType = contentInfo.reportedContentType;
        if (canonicalContentId) {
            req.body = { ...req.body, contentId: canonicalContentId, reportedContentType };
        }
        const resp = await forwardPost('/notices', req.body);

        if (resp?.status >= 200 && resp?.status < 300 && canonicalContentId && req.database?.db) {
            await disableLocallyIfPossible(req, canonicalContentId, reportedContentType);
        }

        if (resp?.status >= 200 && resp?.status < 300 && resp?.data?.token && canonicalContentId && req.database?.db) {
            setDsaStatusTokenIfPossible(req, canonicalContentId, resp.data.token, reportedContentType);
        }

        res.status(resp.status).json(resp.data);
    } catch (err) {
        return next(buildForwardError(err));
    }
});


router.get('/disable/publicmessage/:messageId', moderationToggleLimiter, security.checkToken, async function (req, res, next) {
    try {
        const row = await findMessageByIdOrUuid(req.database.db, req.params.messageId);
        if (!row) {
            return next(apiError.notFound('message_not_found'));
        }
        tableMessage.disableMessage(req.database.db, row.uuid, function (err) {
            if (err) {
                return next(apiError.internal('db_error'));
            }
            res.status(200).json({ status: 200, messageUuid: row.uuid });
        });
    } catch (err) {
        const apiErr = apiError.internal('db_error');
        apiErr.detail = err?.message || err;
        return next(apiErr);
    }
});

router.get('/enable/publicmessage/:messageId', moderationToggleLimiter, security.checkToken, async function (req, res, next) {
    try {
        const row = await findMessageByIdOrUuid(req.database.db, req.params.messageId);
        if (!row) {
            return next(apiError.notFound('message_not_found'));
        }
        tableMessage.enableMessage(req.database.db, row.uuid, function (err) {
            if (err) {
                return next(apiError.internal('db_error'));
            }
            res.status(200).json({ status: 200, messageUuid: row.uuid });
        });
    } catch (err) {
        const apiErr = apiError.internal('db_error');
        apiErr.detail = err?.message || err;
        return next(apiErr);
    }
});


router.get('/disable/secretdrop/:secretDropId', moderationToggleLimiter, security.checkToken, async function (req, res, next) {
    try {
        const row = await findSecretDropByIdOrUuid(req.database.db, req.params.secretDropId);
        if (!row) {
            return next(apiError.notFound('secret_drop_not_found'));
        }
        const disabled = await tableSecretDrop.disableSecretDrop(req.database.db, row.uuid);
        if (!disabled) {
            return next(apiError.notFound('secret_drop_not_found'));
        }
        res.status(200).json({ status: 200, secretDropUuid: row.uuid });
    } catch (err) {
        const apiErr = apiError.internal('db_error');
        apiErr.detail = err?.message || err;
        return next(apiErr);
    }
});

router.get('/enable/secretdrop/:secretDropId', moderationToggleLimiter, security.checkToken, async function (req, res, next) {
    try {
        const row = await findSecretDropByIdOrUuid(req.database.db, req.params.secretDropId);
        if (!row) {
            return next(apiError.notFound('secret_drop_not_found'));
        }
        const enabled = await tableSecretDrop.enableSecretDrop(req.database.db, row.uuid);
        if (!enabled) {
            return next(apiError.notFound('secret_drop_not_found'));
        }
        res.status(200).json({ status: 200, secretDropUuid: row.uuid });
    } catch (err) {
        const apiErr = apiError.internal('db_error');
        apiErr.detail = err?.message || err;
        return next(apiErr);
    }
});

router.get('/health', moderationToggleLimiter, (_req, res) => res.json({ ok: true, adminBase: `${adminBaseUrl}/dsa/frontend` }));

module.exports = router;

/**
 * Evidence for Notices (forward to admin backend)
 * POST /digitalserviceact/notices/:id/evidence
 * - Accepts either multipart/form-data with 'file' or JSON { type: 'url'|'hash', url?, hash? }
 */
router.post('/notices/:id/evidence', evidenceLimiter, noticeEvidencePow, (req, res, next) => {
    upload.single('file')(req, res, async (uploadErr) => {
        try {
            if (uploadErr) {
                if (uploadErr.code === 'LIMIT_FILE_SIZE') {
                    const apiErr = apiError.badRequest('file_too_large');
                    apiErr.maxBytes = maxEvidenceFileBytes;
                    return next(apiErr);
                }
                const apiErr = apiError.badRequest('upload_failed');
                apiErr.detail = uploadErr.message;
                return next(apiErr);
            }

            const id = encodeURIComponent(req.params.id);
            if (req.file) {
                const form = new FormData();
                form.append('file', req.file.buffer, req.file.originalname);
                // pass through optional hash if provided
                if (req.body?.hash) form.append('hash', String(req.body.hash));
                const serviceToken = await signServiceJwt({ audience: ADMIN_AUDIENCE });
                const headers = form.getHeaders({ Authorization: `Bearer ${serviceToken}` });
                const resp = await axios.post(`${adminBaseUrl}/dsa/backend/notices/${id}/evidence`, form, {
                    headers,
                    timeout: 10000,
                    validateStatus: () => true,
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity
                });
                return res.status(resp.status).json(resp.data);
            }

            // JSON forward (url/hash)
            const resp = await forwardPostBackend(`/notices/${id}/evidence`, req.body);
            return res.status(resp.status).json(resp.data);
        } catch (err) {
            return next(buildForwardError(err));
        }
    });
});

/**
 * POST /digitalserviceact/status/:token/evidence
 * For attaching evidence to a notice using the public status token.
 * Forwards to admin public endpoint /public/status/:token/evidence
 */
router.post('/status/:token/evidence', evidenceLimiter, statusEvidencePow, (req, res, next) => {
    upload.single('file')(req, res, async (uploadErr) => {
        try {
            if (uploadErr) {
                if (uploadErr.code === 'LIMIT_FILE_SIZE') {
                    const apiErr = apiError.badRequest('file_too_large');
                    apiErr.maxBytes = maxEvidenceFileBytes;
                    return next(apiErr);
                }
                const apiErr = apiError.badRequest('upload_failed');
                apiErr.detail = uploadErr.message;
                return next(apiErr);
            }

            const token = encodeURIComponent(req.params.token);
            if (req.file) {
                const form = new FormData();
                form.append('file', req.file.buffer, req.file.originalname);
                if (req.body?.hash) form.append('hash', String(req.body.hash));
                const serviceToken = await signServiceJwt({ audience: ADMIN_AUDIENCE });
                const headers = form.getHeaders({ Authorization: `Bearer ${serviceToken}` });
                const resp = await axios.post(`${adminBaseUrl}/public/status/${token}/evidence`, form, {
                    headers,
                    timeout: 10000,
                    validateStatus: () => true,
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity
                });
                return res.status(resp.status).json(resp.data);
            }

            // JSON forward (url/hash) -> use dedicated URL endpoint for robustness
            const serviceToken = await signServiceJwt({ audience: ADMIN_AUDIENCE });
            const headers = { Authorization: `Bearer ${serviceToken}` };
            const endpoint = req.body?.type === 'hash' ? 'evidence' : 'evidence/url';
            const resp = await axios.post(`${adminBaseUrl}/public/status/${token}/${endpoint}`, req.body, {
                headers,
                timeout: 10000,
                validateStatus: () => true
            });
            return res.status(resp.status).json(resp.data);
        } catch (err) {
            return next(buildForwardError(err));
        }
    });
});
