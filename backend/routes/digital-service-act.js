const express = require('express');
const security = require('../middleware/security');
const axios = require('axios');
const rateLimit = require('express-rate-limit');

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

/* --------------------------------- Routes ---------------------------------- */

// POST /dsa/signals  -> forward an {ADMIN_BASE_URL[:ADMIN_PORT]}/dsa/frontend/signals
router.post('/signals', signalLimiter, async (req, res) => {
    try {
        console.log(req.body);
        const resp = await forwardPost('/signals', req.body, req.headers);
        res.status(resp.status).json(resp.data);
    } catch (err) {
        res.status(502).json({ error: 'bad_gateway', detail: err.message });
    }
});

// POST /dsa/notices  -> forward an {ADMIN_BASE_URL[:ADMIN_PORT]}/dsa/frontend/notices
router.post('/notices', noticeLimiter, async (req, res) => {
    try {
        const resp = await forwardPost('/notices', req.body, req.headers);
        res.status(resp.status).json(resp.data);
    } catch (err) {
        res.status(502).json({ error: 'bad_gateway', detail: err.message });
    }
});

router.get('/health', (_req, res) => res.json({ ok: true, adminBase: `${process.env.ADMIN_BASE_URL}:${process.env.ADMIN_PORT}/dsa/frontend` }));

module.exports = router;