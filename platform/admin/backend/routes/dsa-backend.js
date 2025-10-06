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

module.exports = router;