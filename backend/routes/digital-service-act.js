const express = require('express');
const security = require('../middleware/security');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const tableMessage = require('../db/tableMessage');
const tableNotification = require('../db/tableNotification');
const crypto = require('crypto');

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

function truncate(text, maxLength = 160) {
    if (typeof text !== 'string' || text.length <= maxLength) {
        return text || '';
    }
    return `${text.slice(0, maxLength - 1)}…`;
}

function createNotificationForMessage(req, type, resp) {
    return new Promise((resolve) => {
        try {
            const db = req.database?.db;
            const contentId = req.body?.contentId;

            if (!db || !contentId) {
                return resolve(false);
            }

            const sql = `
                SELECT id, uuid, message, userId
                FROM tableMessage
                WHERE uuid = ?
                LIMIT 1;
            `;

            db.get(sql, [contentId], (err, row) => {
                if (err || !row) {
                    return resolve(false);
                }

                const description = type === 'signals'
                    ? 'We forwarded a DSA quick report regarding your content.'
                    : 'We forwarded a formal DSA notice regarding your content.';

                const bodyParts = [description];
                const excerpt = truncate(row.message, 180);
                if (excerpt) {
                    bodyParts.push(`Excerpt: "${excerpt}"`);
                }
                if (req.body?.reasonText) {
                    bodyParts.push(`Reason: ${req.body.reasonText}`);
                }

                const metadata = {
                    contentId: row.uuid,
                    messageId: row.id,
                    dsa: {
                        type,
                        caseId: resp?.data?.id ?? null,
                        token: resp?.data?.token ?? null,
                        statusUrl: resp?.data?.statusUrl ?? null
                    }
                };

                if (req.body?.reasonText) {
                    metadata.reasonText = req.body.reasonText;
                }
                if (req.body?.category) {
                    metadata.category = req.body.category;
                }
                if (req.body?.reportedContentType) {
                    metadata.reportedContentType = req.body.reportedContentType;
                }

                tableNotification.create(
                    db,
                    {
                        uuid: crypto.randomUUID(),
                        userId: row.userId,
                        title: type === 'signals' ? 'DSA signal submitted' : 'DSA notice submitted',
                        body: bodyParts.join(' '),
                        category: 'dsa',
                        source: 'digital-service-act',
                        metadata
                    },
                    (createErr) => {
                        if (createErr && req.logger) {
                            req.logger.error('Failed to store DSA notification', {
                                error: createErr.message || createErr
                            });
                        }
                        resolve(!createErr);
                    }
                );
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

        await createNotificationForMessage(req, 'signals', resp);

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

        await createNotificationForMessage(req, 'notices', resp);

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
