const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const { checkToken } = require('../middleware/security');
const rateLimit = require('express-rate-limit');

// DB-Tabellen
const tableSignal = require('../db/tableDsaSignal');
const tableNotice = require('../db/tableDsaNotice');

const router = express.Router();
router.use(checkToken);

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
        (err, row) => {
            if (err) return res.status(500).json({ error: 'db_error', detail: err.message });
            res.status(201).json(row); // { id }
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
        (err, row) => {
            if (err) return res.status(500).json({ error: 'db_error', detail: err.message });
            res.status(201).json(row); // { id }
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