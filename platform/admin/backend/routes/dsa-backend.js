const express = require('express');
const crypto = require('crypto');
const { requireAdminJwt, requireRole } = require('../middleware/security');

const tableSignal = require('../db/tableDsaSignal');
const tableNotice = require('../db/tableDsaNotice');
const tableDecision = require('../db/tableDsaDecision');
const tableEvidence = require('../db/tableDsaEvidence');
const tableNotification = require('../db/tableDsaNotification');
const tableAudit = require('../db/tableDsaAuditLog');

const router = express.Router();
router.use(requireAdminJwt, requireRole('moderator', 'legal', 'admin', 'root'));

function db(req) { return req.database?.db; }
function asString(v) { return (v === undefined || v === null) ? null : String(v); }
function asNum(v, d) { const n = Number(v); return Number.isFinite(n) ? n : d; }

/** Health */
router.get('/health', (_req, res) => res.json({ ok: true, service: 'dsa-backend' }));

/* ----------------------------- Helper ----------------------------- */
async function enablePublicMessage(messageId) {
    const url = `${process.env.BASE_URL}:${process.env.PORT}/digitalserviceact/enable/publicmessage/${encodeURIComponent(messageId)}`;
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'X-API-Authorization': process.env.BACKEND_TOKEN,
            'Accept': 'application/json'
        }
    });
    let json = null;
    try { json = await res.json(); } catch { /* noop */ }
    const ok = res.ok && (json?.status === 200 || json?.ok === true);
    return { ok, status: res.status, json };
}


/* ----------------------------- Notices ----------------------------- */
router.get('/notices', (req, res) => {
    const _db = db(req); if (!_db) return res.status(500).json({ error: 'database_unavailable' });

    const status = req.query.status;
    const statusFilter = status ? (Array.isArray(status) ? status : [status]) : undefined;

    tableNotice.list(
        _db,
        {
            status: statusFilter,
            contentId: asString(req.query.contentId ?? undefined),
            reportedContentType: asString(req.query.type ?? undefined),
            limit: asNum(req.query.limit, 100),
            offset: asNum(req.query.offset, 0)
        },
        (err, rows) => {
            if (err) return res.status(500).json({ error: 'db_error', detail: err.message });
            res.json(rows);
        }
    );
});

router.get('/notices/:id', (req, res) => {
    const _db = db(req); if (!_db) return res.status(500).json({ error: 'database_unavailable' });
    tableNotice.getById(_db, req.params.id, (err, row) => {
        if (err) return res.status(500).json({ error: 'db_error', detail: err.message });
        if (!row) return res.status(404).json({ error: 'not_found' });
        res.json(row);
    });
});

router.patch('/notices/:id/status', (req, res) => {
    const _db = db(req); if (!_db) return res.status(500).json({ error: 'database_unavailable' });

    const newStatus = String(req.body?.status || 'UNDER_REVIEW');
    const updatedAt = Date.now();

    tableNotice.updateStatus(_db, req.params.id, newStatus, updatedAt, (err, ok) => {
        if (err) return res.status(500).json({ error: 'db_error', detail: err.message });
        if (!ok) return res.status(404).json({ error: 'not_found' });

        // Audit
        const auditId = crypto.randomUUID();
        tableAudit.create(
            _db, auditId, 'notice', req.params.id, 'status_change',
            `admin:${req.admin?.sub || 'unknown'}`, updatedAt, JSON.stringify({ status: newStatus }),
            () => { }
        );
        res.json({ ok: true });
    });
});

/**
 * GET /dsa/backend/notices/:id/decision
 * Liefert die Entscheidung (falls vorhanden) zu einer Notice.
 */
router.get('/notices/:id/decision', (req, res) => {
    const _db = req.database?.db;
    if (!_db) return res.status(500).json({ error: 'database_unavailable' });

    const noticeId = req.params.id;
    if (!noticeId) return res.status(400).json({ error: 'missing_notice_id' });

    const tableDecision = require('../db/tableDsaDecision');

    tableDecision.getByNoticeId(_db, noticeId, (err, row) => {
        if (err) return res.status(500).json({ error: 'db_error', detail: err.message });
        if (!row) return res.status(404).json({ error: 'decision_not_found' });
        res.json(row);
    });
});

/* ---------------------------- Decisions ---------------------------- */
router.post('/notices/:id/decision', (req, res) => {
    const _db = db(req); if (!_db) return res.status(500).json({ error: 'database_unavailable' });

    const id = crypto.randomUUID();
    const decidedAt = Date.now();
    const outcome = String(req.body?.outcome || 'NO_ACTION');
    const legalBasis = asString(req.body?.legalBasis);
    const tosBasis = asString(req.body?.tosBasis);
    const automatedUsed = req.body?.automatedUsed ? 1 : 0;
    const statement = asString(req.body?.statement);

    tableDecision.create(
        _db, id, req.params.id, outcome, legalBasis, tosBasis, automatedUsed,
        `admin:${req.admin?.sub || 'unknown'}`, decidedAt, statement,
        (err, row) => {
            if (err) return res.status(500).json({ error: 'db_error', detail: err.message });

            // Status -> DECIDED
            tableNotice.updateStatus(_db, req.params.id, 'DECIDED', decidedAt, () => { });

            // Audit
            const auditId = crypto.randomUUID();
            tableAudit.create(
                _db, auditId, 'decision', id, 'create',
                `admin:${req.admin?.sub || 'unknown'}`, decidedAt,
                JSON.stringify({ noticeId: req.params.id, outcome }),
                () => { }
            );

            res.status(201).json(row); // { id }
        }
    );
});

/* ----------------------------- Evidence ----------------------------- */
router.post('/notices/:id/evidence', (req, res) => {
    const _db = db(req); if (!_db) return res.status(500).json({ error: 'database_unavailable' });

    const id = crypto.randomUUID();
    const addedAt = Date.now();
    const type = String(req.body?.type || 'url');
    const url = asString(req.body?.url);
    const hash = asString(req.body?.hash);

    tableEvidence.create(_db, id, req.params.id, type, url, hash, addedAt, (err, row) => {
        if (err) return res.status(500).json({ error: 'db_error', detail: err.message });

        const auditId = crypto.randomUUID();
        tableAudit.create(
            _db, auditId, 'notice', req.params.id, 'evidence_add',
            `admin:${req.admin?.sub || 'unknown'}`, addedAt,
            JSON.stringify({ evidenceId: id, type }),
            () => { }
        );

        res.status(201).json(row);
    });
});

router.get('/notices/:id/evidence', (req, res) => {
    const _db = db(req); if (!_db) return res.status(500).json({ error: 'database_unavailable' });

    tableEvidence.listByNotice(
        _db,
        { noticeId: req.params.id, type: asString(req.query?.type), limit: asNum(req.query.limit, 100), offset: asNum(req.query.offset, 0) },
        (err, rows) => {
            if (err) return res.status(500).json({ error: 'db_error', detail: err.message });
            res.json(rows);
        }
    );
});

/* --------------------------- Notifications --------------------------- */
router.post('/notifications', (req, res) => {
    const _db = db(req); if (!_db) return res.status(500).json({ error: 'database_unavailable' });

    const id = crypto.randomUUID();
    const sentAt = Date.now();
    const noticeId = asString(req.body?.noticeId);
    const decisionId = asString(req.body?.decisionId);
    const stakeholder = String(req.body?.stakeholder || 'reporter'); // reporter|uploader|other
    const channel = String(req.body?.channel || 'inapp');            // email|inapp|webhook
    const payloadJson = JSON.stringify(req.body?.payload ?? {});
    const metaJson = req.body?.meta ? JSON.stringify(req.body.meta) : null;

    tableNotification.create(_db, id, noticeId, decisionId, stakeholder, channel, sentAt, payloadJson, metaJson, (err, row) => {
        if (err) return res.status(500).json({ error: 'db_error', detail: err.message });

        const entityType = decisionId ? 'decision' : 'notice';
        const entityId = decisionId || noticeId || 'unknown';

        const auditId = crypto.randomUUID();
        tableAudit.create(
            _db, auditId, entityType, entityId, 'notify',
            `admin:${req.admin?.sub || 'unknown'}`, sentAt,
            JSON.stringify({ stakeholder, channel }),
            () => { }
        );

        res.status(201).json(row);
    });
});

/* ------------------------------- Audit ------------------------------- */
router.get('/audit/:entityType/:entityId', (req, res) => {
    const _db = db(req); if (!_db) return res.status(500).json({ error: 'database_unavailable' });

    tableAudit.listByEntity(
        _db,
        { entityType: String(req.params.entityType), entityId: String(req.params.entityId), limit: asNum(req.query.limit, 200), offset: asNum(req.query.offset, 0) },
        (err, rows) => {
            if (err) return res.status(500).json({ error: 'db_error', detail: err.message });
            res.json(rows);
        }
    );
});

/** -------------------- STATS: NOTICES -------------------- **/
router.get('/stats/notices', (req, res) => {
    const _db = db(req);
    if (!_db) return res.status(500).json({ error: 'database_unavailable' });

    tableNotice.stats(_db, (err, result) => {
        if (err) return res.status(500).json({ error: 'db_error', detail: err.message });
        res.json(result); // { total, open, byStatus }
    });
});

/** -------------------- STATS: SIGNALS -------------------- **/
router.get('/stats/signals', (req, res) => {
    const _db = db(req);
    if (!_db) return res.status(500).json({ error: 'database_unavailable' });

    tableSignal.stats(_db, (err, result) => {
        if (err) return res.status(500).json({ error: 'db_error', detail: err.message });
        res.json(result); // { total, last24h, byType }
    });
});

/* ----------------------------- Signals ----------------------------- */

/**
 * GET /signals
 * Optional Query:
 *  - type: reportedContentType
 *  - category: frei (z. B. 'hate', 'privacy')
 *  - contentId: exakte ID-Suche
 *  - since: unix ms (createdAt >= since)
 *  - q: LIKE über reasonText/contentId/reportedContent
 *  - limit, offset
 */
router.get('/signals', (req, res) => {
    const _db = db(req); if (!_db) return res.status(500).json({ error: 'database_unavailable' });

    const opts = {
        contentId: req.query.contentId ? String(req.query.contentId) : undefined,
        reportedContentType: req.query.type ? String(req.query.type) : undefined,
        category: req.query.category ? String(req.query.category) : undefined,
        since: req.query.since ? Number(req.query.since) : undefined,
        q: req.query.q ? String(req.query.q) : undefined,
        limit: asNum(req.query.limit, 100),
        offset: asNum(req.query.offset, 0)
    };

    tableSignal.list(_db, opts, (err, rows) => {
        if (err) return res.status(500).json({ error: 'db_error', detail: err.message });
        res.json(rows);
    });
});

/**
 * GET /signals/:id
 */
router.get('/signals/:id', (req, res) => {
    const _db = db(req); if (!_db) return res.status(500).json({ error: 'database_unavailable' });

    tableSignal.getById(_db, String(req.params.id), (err, row) => {
        if (err) return res.status(500).json({ error: 'db_error', detail: err.message });
        if (!row) return res.status(404).json({ error: 'not_found' });
        res.json(row);
    });
});

/**
 * POST /signals/:id/promote
 * - erzeugt ein Notice (Status: RECEIVED)
 * - audit: signal:promote, notice:create
 * - **löscht** das Signal + audit: signal:delete (mit Snapshot)
 */
router.post('/signals/:id/promote', (req, res) => {
    const _db = db(req);
    if (!_db) return res.status(500).json({ error: 'database_unavailable' });

    const signalId = String(req.params.id);
    const now = Date.now();

    tableSignal.getById(_db, signalId, (err, sig) => {
        if (err) return res.status(500).json({ error: 'db_error', detail: err.message });
        if (!sig) return res.status(404).json({ error: 'signal_not_found' });

        // Notice aus Signal bauen
        const noticeId = crypto.randomUUID();
        const status = 'RECEIVED';

        const contentId = sig.contentId;
        const contentUrl = sig.contentUrl ?? null;
        const category = sig.category ?? null;
        const reasonText = sig.reasonText ?? null;
        const reporterEmail = null;
        const reporterName = null;
        const truthAffirmation = null;
        const reportedContentType = sig.reportedContentType;
        const reportedContentJson = sig.reportedContent;

        tableNotice.create(
            _db,
            noticeId,
            contentId,
            contentUrl,
            category,
            reasonText,
            reporterEmail,
            reporterName,
            truthAffirmation,
            reportedContentType,
            reportedContentJson,
            status,
            now,
            now,
            (err2) => {
                if (err2) return res.status(500).json({ error: 'db_error', detail: err2.message });

                // Audit: Signal → promote
                const auditId1 = crypto.randomUUID();
                tableAudit.create(
                    _db, auditId1, 'signal', signalId, 'promote',
                    `admin:${req.admin?.sub || 'unknown'}`, now,
                    JSON.stringify({ noticeId }),
                    () => { }
                );

                // Audit: Notice → create
                const auditId2 = crypto.randomUUID();
                tableAudit.create(
                    _db, auditId2, 'notice', noticeId, 'create',
                    `admin:${req.admin?.sub || 'unknown'}`, now,
                    JSON.stringify({ source: 'signal', signalId }),
                    () => { }
                );

                // **Signal löschen** (hard) + Audit mit Snapshot
                tableSignal.remove(_db, signalId, (err3, ok) => {
                    if (err3) {
                        // Nicht fatal – Notice existiert bereits; wir loggen Fehler im Audit
                        const auditIdErr = crypto.randomUUID();
                        tableAudit.create(
                            _db, auditIdErr, 'signal', signalId, 'delete_failed',
                            `admin:${req.admin?.sub || 'unknown'}`, now,
                            JSON.stringify({ noticeId, error: err3.message }),
                            () => { }
                        );
                        return res.status(201).json({ noticeId, removed: false });
                    }
                    if (!ok) {
                        return res.status(201).json({ noticeId, removed: false });
                    }

                    const auditId3 = crypto.randomUUID();
                    tableAudit.create(
                        _db, auditId3, 'signal', signalId, 'delete',
                        `admin:${req.admin?.sub || 'unknown'}`, now,
                        JSON.stringify({ reason: 'promoted_to_notice', snapshot: sig }),
                        () => { }
                    );

                    res.status(201).json({ noticeId, removed: true });
                });
            }
        );
    });
});

/**
 * DELETE /signals/:id
 * - Hard delete + Audit (inkl. optionalem reason aus Body)
 */
router.delete('/signals/:id', (req, res) => {
    const _db = db(req);
    if (!_db) return res.status(500).json({ error: 'database_unavailable' });

    const id = String(req.params.id);
    const reason = (req.body && typeof req.body.reason === 'string') ? req.body.reason : 'dismissed_by_admin';
    const now = Date.now();

    // Für Audit Snapshot holen
    tableSignal.getById(_db, id, async (e1, sig) => {
        if (e1) return res.status(500).json({ error: 'db_error', detail: e1.message });
        if (!sig) return res.status(404).json({ error: 'not_found' });

        try {
            const resp = await enablePublicMessage(String(sig.contentId));
            if (!resp.ok) {
                return res.status(502).json({
                    error: 'enable_failed',
                    upstreamStatus: resp.status,
                    upstream: resp.json
                });
            }
        } catch (e) {
            return res.status(502).json({ error: 'enable_failed', detail: String(e?.message || e) });
        }

        tableSignal.remove(_db, id, (e2, ok) => {
            if (e2) return res.status(500).json({ error: 'db_error', detail: e2.message });
            if (!ok) return res.status(404).json({ error: 'not_found' });

            // Audit: Signal delete + Snapshot
            const auditId = crypto.randomUUID();
            tableAudit.create(
                _db, auditId, 'signal', id, 'delete',
                `admin:${req.admin?.sub || 'unknown'}`, now,
                JSON.stringify({ reason, snapshot: sig }),
                () => { }
            );

            res.json({ deleted: true });
        });
    });
});

// dsa-backend routes (Ausschnitt)
router.get('/audit', (req, res) => {
    const _db = db(req);
    if (!_db) return res.status(500).json({ error: 'database_unavailable' });

    const opts = {
        entityType: asString(req.query.entityType),    // 'notice' | 'signal' | ...
        action: asString(req.query.action),           // 'create' | 'status_change' | ...
        actor: asString(req.query.actor),             // optional
        since: asNum(req.query.since, null),          // unix ms
        until: asNum(req.query.until, null),          // unix ms
        q: asString(req.query.q),                     // LIKE über actor/entityId/action
        limit: asNum(req.query.limit, 100),
        offset: asNum(req.query.offset, 0)
    };

    tableAudit.search(_db, opts, (err, rows) => {
        if (err) return res.status(500).json({ error: 'db_error', detail: err.message });
        res.json(rows);
    });
});

module.exports = router;