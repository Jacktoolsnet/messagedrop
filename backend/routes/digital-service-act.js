const express = require('express');
const security = require('../middleware/security');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const tableMessage = require('../db/tableMessage');

const router = express.Router();

router.use(security.checkToken);
router.use(express.json({ limit: '1mb' }));

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

/* --------------------------------- Helper ---------------------------------- */
async function forwardPost(path, body, reqHeaders) {
    const url = `${process.env.ADMIN_BASE_URL}:${process.env.ADMIN_PORT}/dsa/frontend${path}`;
    const headers = {
        'content-type': 'application/json',
        'x-api-authorization': process.env.ADMIN_TOKEN,
    };
    // Falls du das User-JWT mitgeben willst, einkommentieren:
    // if (reqHeaders?.authorization) headers.authorization = reqHeaders.authorization;

    const resp = await axios.post(url, body, {
        headers,
        timeout: 5000,
        validateStatus: () => true
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

function enableLocallyIfPossible(req) {
    return new Promise((resolve) => {
        try {
            const db = req.database?.db;
            const contentId = req.body?.contentId;
            if (!db || !contentId) return resolve(false);

            tableMessage.enableMessage(db, contentId, (err) => {
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
