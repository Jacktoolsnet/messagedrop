const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const { checkToken } = require('../middleware/security');
const rateLimit = require('express-rate-limit');

// DB-Tabellen
const tableSignal = require('../db/tableDsaSignal');
const tableNotice = require('../db/tableDsaNotice');
const tableAudit = require('../db/tableDsaAuditLog');

const router = express.Router();
router.use(checkToken);

const statusBaseUrl = (process.env.PUBLIC_STATUS_BASE_URL || '').replace(/\/+$/, '') || null;

function generateStatusToken() {
    return crypto.randomBytes(24).toString('base64url');
}

function buildStatusUrl(token) {
    if (!token || !statusBaseUrl) return null;
    return `${statusBaseUrl}/${token}`;
}

function truncate(text, maxLength = 160) {
    if (typeof text !== 'string' || text.length <= maxLength) {
        return text || '';
    }
    return `${text.slice(0, maxLength - 1)}…`;
}

async function notifyContentOwner(req, notification) {
    const { contentId, type } = notification || {};
    if (!contentId || !process.env.BASE_URL || !process.env.PORT || !process.env.BACKEND_TOKEN) {
        return false;
    }

    const baseUrl = `${process.env.BASE_URL}:${process.env.PORT}`;
    const headers = {
        'X-API-Authorization': process.env.BACKEND_TOKEN,
        'Accept': 'application/json'
    };

    try {
        const messageResp = await axios.get(
            `${baseUrl}/message/get/uuid/${encodeURIComponent(contentId)}`,
            {
                headers,
                timeout: 5000,
                validateStatus: () => true
            }
        );

        if (messageResp.status !== 200 || messageResp.data?.status !== 200 || !messageResp.data?.message) {
            return false;
        }

        const message = messageResp.data.message;
        if (!message?.userId) {
            return false;
        }

        const kindLabel = type === 'signal' ? 'quick report (signal)' : 'formal DSA notice';
        const excerpt = truncate(message.message || '', 180);

        const bodySegments = [`We received a ${kindLabel} about one of your messages.`];
        if (excerpt) {
            bodySegments.push(`Message excerpt: "${excerpt}"`);
        }
        if (notification.category) {
            bodySegments.push(`Category: ${notification.category}`);
        }
        if (notification.reasonText) {
            bodySegments.push(`Reason provided: ${notification.reasonText}`);
        }
        if (notification.statusUrl) {
            bodySegments.push('You can review the case via the status page.');
        }

        const metadata = {
            contentId: message.uuid,
            messageId: message.id,
            category: notification.category ?? null,
            reasonText: notification.reasonText ?? null,
            reportedContentType: notification.reportedContentType ?? null,
            dsa: {
                type,
                caseId: notification.caseId ?? null,
                token: notification.token ?? null,
                statusUrl: notification.statusUrl ?? null
            }
        };

        const payload = {
            userId: message.userId,
            title: type === 'signal' ? 'New DSA signal' : 'New DSA notice',
            body: bodySegments.join(' '),
            category: 'dsa',
            source: 'digital-service-act',
            metadata
        };

        const response = await axios.post(
            `${baseUrl}/notification/create`,
            payload,
            {
                headers,
                timeout: 5000,
                validateStatus: () => true
            }
        );

        if (response.status >= 200 && response.status < 300) {
            return true;
        }

        req.logger?.warn?.('Notification creation returned non-2xx', {
            status: response.status,
            type,
            contentId
        });
        return false;
    } catch (error) {
        if (req.logger?.warn) {
            req.logger.warn('Failed to send system notification to uploader', {
                error: error.message,
                type,
                contentId
            });
        } else {
            console.warn('Failed to send system notification to uploader', error.message);
        }
        return false;
    }
}

/* ---------------------- Minimaler Make-Notifier (axios) ---------------------- */
function notifyMake(title, text) {
    const url = process.env.MAKE_DSA_WEBHOOK_URL;
    const apiKey = process.env.MAKE_API_KEY;
    if (!url || !apiKey) return;

    // fire-and-forget: nicht awaiten, Fehler nur loggen
    axios.post(url, { title, text }, {
        headers: { 'x-make-apikey': apiKey }
    }).catch(() => { });
}

/* ------------------------------ Rate Limits ------------------------------ */
const signalLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 Minuten
    limit: 100,               // 100 Signals / 10 min / IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many reports (signals). Please try again later.' }
});

const noticeLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 Minuten
    limit: 60,                // 60 Notices / 10 min / IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many notices. Please try again later.' }
});

/* ------------------------------ Helpers ------------------------------ */
function toStringOrNull(v) { return (v === undefined || v === null) ? null : String(v); }
function toInt01OrNull(v) { return (v === undefined || v === null) ? null : (v ? 1 : 0); }
function db(req) { return req.database?.db; }

/* -------------------------------- Routes -------------------------------- */

/**
 * POST /dsa/frontend/signals
 * Quick report (informelles Signal). Nur contentId ist „sinnvoll“; alles andere optional.
 */
router.post('/signals', signalLimiter, (req, res) => {
    const _db = db(req); if (!_db) return res.status(500).json({ error: 'database_unavailable' });

    const id = crypto.randomUUID();
    const now = Date.now();
    const {
        contentId,
        contentUrl,
        category,
        reasonText,
        reportedContentType = 'public message',
        reportedContent
    } = req.body || {};

    if (!contentId) return res.status(400).json({ error: 'contentId is required' });

    let reportedContentJson = 'null';
    try { reportedContentJson = JSON.stringify(reportedContent ?? null); }
    catch { reportedContentJson = JSON.stringify({ _error: 'stringify_failed' }); }

    const token = generateStatusToken();
    const statusUrl = buildStatusUrl(token);

    tableSignal.create(
        _db,
        id,
        toStringOrNull(contentId),
        toStringOrNull(contentUrl),
        toStringOrNull(category),
        toStringOrNull(reasonText),
        toStringOrNull(reportedContentType),
        reportedContentJson,
        now,
        token,
        now,
        (err, row) => {
            if (err) return res.status(500).json({ error: 'db_error', detail: err.message });
            const responsePayload = { id: row?.id ?? id, token, statusUrl };

            tableAudit.create(
                _db,
                crypto.randomUUID(),
                'signal',
                id,
                'create',
                `public:${req.ip || 'unknown'}`,
                now,
                JSON.stringify({
                    statusUrl,
                    token,
                    contentId,
                    category,
                    reasonText,
                    reportedContentType,
                    userAgent: req.headers['user-agent'] || null
                }),
                () => { }
            );

            res.status(201).json(responsePayload);

            void notifyContentOwner(req, {
                type: 'signal',
                caseId: responsePayload.id,
                contentId,
                category,
                reasonText,
                reportedContentType,
                token,
                statusUrl
            });
            // Make-Push (sehr knapp gehalten)
            notifyMake(
                'New Signal',
                `Type: ${reportedContentType}\nContentId: ${contentId}\nCategory: ${category || '-'}\nReason: ${reasonText || '-'}`
            );
        }
    );
});

/**
 * POST /dsa/frontend/notices
 * Formale DSA-Notice (alle Felder optional außer contentId).
 */
router.post('/notices', noticeLimiter, (req, res) => {
    const _db = db(req); if (!_db) return res.status(500).json({ error: 'database_unavailable' });

    const id = crypto.randomUUID();
    const now = Date.now();
    const {
        contentId,
        contentUrl,
        category,
        reasonText,
        reporterEmail,
        reporterName,
        truthAffirmation,
        reportedContentType = 'public message',
        reportedContent
    } = req.body || {};

    if (!contentId) return res.status(400).json({ error: 'contentId is required' });

    let reportedContentJson = 'null';
    try { reportedContentJson = JSON.stringify(reportedContent ?? null); }
    catch { reportedContentJson = JSON.stringify({ _error: 'stringify_failed' }); }

    const status = 'RECEIVED';

    const token = generateStatusToken();
    const statusUrl = buildStatusUrl(token);

    tableNotice.create(
        _db,
        id,
        toStringOrNull(contentId),
        toStringOrNull(contentUrl),
        toStringOrNull(category),
        toStringOrNull(reasonText),
        toStringOrNull(reporterEmail),
        toStringOrNull(reporterName),
        toInt01OrNull(truthAffirmation),
        toStringOrNull(reportedContentType),
        reportedContentJson,
        status,
        now,
        now,
        token,
        now,
        (err, row) => {
            if (err) return res.status(500).json({ error: 'db_error', detail: err.message });
            const responsePayload = { id: row?.id ?? id, token, statusUrl };

            tableAudit.create(
                _db,
                crypto.randomUUID(),
                'notice',
                id,
                'create',
                `public:${req.ip || 'unknown'}`,
                now,
                JSON.stringify({
                    statusUrl,
                    token,
                    contentId,
                    category,
                    reasonText,
                    reporterEmail,
                    reporterName,
                    reportedContentType,
                    truthAffirmation,
                    userAgent: req.headers['user-agent'] || null
                }),
                () => { }
            );

            res.status(201).json(responsePayload);

            void notifyContentOwner(req, {
                type: 'notice',
                caseId: responsePayload.id,
                contentId,
                category,
                reasonText,
                reportedContentType,
                token,
                statusUrl
            });
            // Make-Push (kurz & bündig)
            notifyMake(
                'New Notice',
                `Status: ${status}\nType: ${reportedContentType}\nContentId: ${contentId}\nReporter: ${reporterName || '-'} (${reporterEmail || '-'})\nCategory: ${category || '-'}`
            );
        }
    );
});

/** Health */
router.get('/health', (_req, res) => res.json({ ok: true, service: 'dsa-frontend' }));

module.exports = router;
