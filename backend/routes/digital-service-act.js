const express = require('express');
const security = require('../middleware/security');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const FormData = require('form-data');
const tableMessage = require('../db/tableMessage');

const router = express.Router();

router.use(security.checkToken);
router.use(express.json({ limit: '1mb' }));

const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });

/* -------------------------------- Rate Limits ------------------------------- */
const signalLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 150,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many DSA report requests. Please try again later.' }
});

const noticeLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 90,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many DSA notice requests. Please try again later.' }
});

const evidenceLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many evidence uploads. Please try again later.' }
});

/* --------------------------------- Helper ---------------------------------- */
async function forwardPost(path, body, reqHeaders = {}) {
    const url = `${process.env.ADMIN_BASE_URL}:${process.env.ADMIN_PORT}/dsa/frontend${path}`;
    const headers = {
        'content-type': 'application/json',
        'x-api-authorization': process.env.ADMIN_TOKEN,
    };
    if (reqHeaders?.authorization) {
        headers.authorization = reqHeaders.authorization;
    }

    const resp = await axios.post(url, body, {
        headers,
        timeout: 5000,
        validateStatus: () => true
    });
    return resp;
}

async function forwardPostBackend(path, body, extraHeaders = {}) {
    const url = `${process.env.ADMIN_BASE_URL}:${process.env.ADMIN_PORT}/dsa/backend${path}`;
    const headers = {
        'x-api-authorization': process.env.ADMIN_TOKEN,
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
router.post('/signals', signalLimiter, async (req, res) => {
    try {
        await disableLocallyIfPossible(req);
        const resp = await forwardPost('/signals', req.body, req.headers);

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
        res.status(502).json({ error: 'bad_gateway', detail: err.message });
    }
});

// POST /dsa/notices  -> forward an {ADMIN_BASE_URL[:ADMIN_PORT]}/dsa/frontend/notices
router.post('/notices', noticeLimiter, async (req, res) => {
    try {
        await disableLocallyIfPossible(req);
        const resp = await forwardPost('/notices', req.body, req.headers);

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
        res.status(502).json({ error: 'bad_gateway', detail: err.message });
    }
});


router.get('/disable/publicmessage/:messageId', function (req, res) {
    let response = { 'status': 0 };
    tableMessage.disableMessage(req.database.db, req.params.messageId, function (err) {
        if (err) {
            response.status = 500;
            response.error = err;
        } else {
            response.status = 200;
        }
        res.status(response.status).json(response);
    });
});

router.get('/enable/publicmessage/:messageId', function (req, res) {
    let response = { 'status': 0 };
    tableMessage.enableMessage(req.database.db, req.params.messageId, function (err) {
        if (err) {
            response.status = 500;
            response.error = err;
        } else {
            response.status = 200;
        }
        res.status(response.status).json(response);
    });
});

router.get('/health', (_req, res) => res.json({ ok: true, adminBase: `${process.env.ADMIN_BASE_URL}:${process.env.ADMIN_PORT}/dsa/frontend` }));

module.exports = router;

/**
 * Evidence for Notices (forward to admin backend)
 * POST /digitalserviceact/notices/:id/evidence
 * - Accepts either multipart/form-data with 'file' or JSON { type: 'url'|'hash', url?, hash? }
 */
router.post('/notices/:id/evidence', evidenceLimiter, (req, res) => {
    upload.single('file')(req, res, async (uploadErr) => {
        try {
            if (uploadErr) {
                if (uploadErr.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ error: 'file_too_large' });
                }
                return res.status(400).json({ error: 'upload_failed', detail: uploadErr.message });
            }

            const id = encodeURIComponent(req.params.id);
            if (req.file) {
                const form = new FormData();
                form.append('file', req.file.buffer, req.file.originalname);
                // pass through optional hash if provided
                if (req.body?.hash) form.append('hash', String(req.body.hash));
                const headers = form.getHeaders({ 'x-api-authorization': process.env.ADMIN_TOKEN });
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
            return res.status(err?.response?.status || 502).json(err?.response?.data || { error: 'bad_gateway' });
        }
    });
});

/**
 * POST /digitalserviceact/status/:token/evidence
 * For attaching evidence to a notice using the public status token.
 * Forwards to admin public endpoint /public/status/:token/evidence
 */
router.post('/status/:token/evidence', evidenceLimiter, (req, res) => {
    upload.single('file')(req, res, async (uploadErr) => {
        try {
            if (uploadErr) {
                if (uploadErr.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ error: 'file_too_large' });
                }
                return res.status(400).json({ error: 'upload_failed', detail: uploadErr.message });
            }

            const token = encodeURIComponent(req.params.token);
            if (req.file) {
                const form = new FormData();
                form.append('file', req.file.buffer, req.file.originalname);
                if (req.body?.hash) form.append('hash', String(req.body.hash));
                const headers = form.getHeaders({ 'x-api-authorization': process.env.ADMIN_TOKEN });
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
            const headers = { 'x-api-authorization': process.env.ADMIN_TOKEN };
            const endpoint = req.body?.type === 'hash' ? 'evidence' : 'evidence/url';
            const resp = await axios.post(`${process.env.ADMIN_BASE_URL}:${process.env.ADMIN_PORT}/public/status/${token}/${endpoint}`, req.body, {
                headers,
                timeout: 10000,
                validateStatus: () => true
            });
            return res.status(resp.status).json(resp.data);
        } catch (err) {
            return res.status(err?.response?.status || 502).json(err?.response?.data || { error: 'bad_gateway' });
        }
    });
});
