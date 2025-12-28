const express = require('express');
const axios = require('axios');
const security = require('../middleware/security');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const FormData = require('form-data');
const tableMessage = require('../db/tableMessage');
const { signServiceJwt } = require('../utils/serviceJwt');
const { createPowGuard } = require('../middleware/pow');
const { apiError } = require('../middleware/api-error');

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

async function ensureContentExists(req, contentId, next) {
    const db = req.database?.db;
    if (!db) {
        next(apiError.internal('database_unavailable'));
        return false;
    }
    const raw = String(contentId ?? '').trim();
    if (!raw) {
        next(apiError.badRequest('contentId is required'));
        return false;
    }
    try {
        const row = await findMessageByIdOrUuid(db, raw);
        if (!row) {
            next(apiError.notFound('message_not_found'));
            return false;
        }
        return true;
    } catch (err) {
        const apiErr = apiError.internal('db_error');
        apiErr.detail = err?.message || err;
        next(apiErr);
        return false;
    }
}

async function forwardPost(path, body) {
    const url = `${process.env.ADMIN_BASE_URL}:${process.env.ADMIN_PORT}/dsa/frontend${path}`;
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
    const url = `${process.env.ADMIN_BASE_URL}:${process.env.ADMIN_PORT}/dsa/backend${path}`;
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

function disableLocallyIfPossible(req) {
    return new Promise((resolve) => {
        try {
            const db = req.database?.db;
            const contentId = req.body?.contentId;
            if (!db || !contentId) return resolve(false);

            tableMessage.disableMessage(db, contentId, (err) => {
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

/* --------------------------------- Routes ---------------------------------- */

// POST /dsa/signals  -> forward an {ADMIN_BASE_URL[:ADMIN_PORT]}/dsa/frontend/signals
router.post('/signals', signalLimiter, reportHourlyLimiter, async (req, res, next) => {
    try {
        if (!(await ensureContentExists(req, req.body?.contentId, next))) return;
        const resp = await forwardPost('/signals', req.body);

        if (resp?.status >= 200 && resp?.status < 300 && req.body?.contentId && req.database?.db) {
            await disableLocallyIfPossible(req);
        }

        if (resp?.status >= 200 && resp?.status < 300 && resp?.data?.token && req.body?.contentId && req.database?.db) {
            tableMessage.setDsaStatusToken(
                req.database.db,
                req.body.contentId,
                resp.data.token,
                Date.now(),
                () => { }
            );
        }

        res.status(resp.status).json(resp.data);
    } catch (err) {
        return next(buildForwardError(err));
    }
});

// POST /dsa/notices  -> forward an {ADMIN_BASE_URL[:ADMIN_PORT]}/dsa/frontend/notices
router.post('/notices', noticeLimiter, reportHourlyLimiter, noticePow, async (req, res, next) => {
    try {
        if (!(await ensureContentExists(req, req.body?.contentId, next))) return;
        const resp = await forwardPost('/notices', req.body);

        if (resp?.status >= 200 && resp?.status < 300 && req.body?.contentId && req.database?.db) {
            await disableLocallyIfPossible(req);
        }

        if (resp?.status >= 200 && resp?.status < 300 && resp?.data?.token && req.body?.contentId && req.database?.db) {
            tableMessage.setDsaStatusToken(
                req.database.db,
                req.body.contentId,
                resp.data.token,
                Date.now(),
                () => { }
            );
        }

        res.status(resp.status).json(resp.data);
    } catch (err) {
        return next(buildForwardError(err));
    }
});


router.get('/disable/publicmessage/:messageId', moderationToggleLimiter, security.checkToken, function (req, res, next) {
    tableMessage.disableMessage(req.database.db, req.params.messageId, function (err) {
        if (err) {
            return next(apiError.internal('db_error'));
        }
        res.status(200).json({ status: 200 });
    });
});

router.get('/enable/publicmessage/:messageId', moderationToggleLimiter, security.checkToken, function (req, res, next) {
    tableMessage.enableMessage(req.database.db, req.params.messageId, function (err) {
        if (err) {
            return next(apiError.internal('db_error'));
        }
        res.status(200).json({ status: 200 });
    });
});

router.get('/health', moderationToggleLimiter, (_req, res) => res.json({ ok: true, adminBase: `${process.env.ADMIN_BASE_URL}:${process.env.ADMIN_PORT}/dsa/frontend` }));

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
                const resp = await axios.post(`${process.env.ADMIN_BASE_URL}:${process.env.ADMIN_PORT}/dsa/backend/notices/${id}/evidence`, form, {
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
                const resp = await axios.post(`${process.env.ADMIN_BASE_URL}:${process.env.ADMIN_PORT}/public/status/${token}/evidence`, form, {
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
            const resp = await axios.post(`${process.env.ADMIN_BASE_URL}:${process.env.ADMIN_PORT}/public/status/${token}/${endpoint}`, req.body, {
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
