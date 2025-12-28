const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const axios = require('axios');
const { requireAdminJwt, requireRole } = require('../middleware/security');
const { notifyContentOwner } = require('../utils/notifyContentOwner');
const { notifyReporter } = require('../utils/notifyReporter');
const { signServiceJwt } = require('../utils/serviceJwt');
const { apiError } = require('../middleware/api-error');

const tableSignal = require('../db/tableDsaSignal');
const tableNotice = require('../db/tableDsaNotice');
const tableDecision = require('../db/tableDsaDecision');
const tableAppeal = require('../db/tableDsaAppeal');
const tableEvidence = require('../db/tableDsaEvidence');
const tableNotification = require('../db/tableDsaNotification');
const tableAudit = require('../db/tableDsaAuditLog');
const { recordNotification } = require('../utils/recordNotification');
const { sendMail } = require('../utils/mailer');

const router = express.Router();
router.use(requireAdminJwt, requireRole('moderator', 'legal', 'admin', 'root'));

const evidenceUploadDir = path.join(__dirname, '..', 'uploads', 'evidence');
fs.mkdirSync(evidenceUploadDir, { recursive: true });
const maxEvidenceFiles = Math.max(1, Number(process.env.DSA_EVIDENCE_MAX_FILES || 4));
const maxEvidenceFileBytes = Math.max(1, Number(process.env.DSA_EVIDENCE_MAX_FILE_MB || 1)) * 1024 * 1024;
const minFreeStorageMb = Math.max(0, Number(process.env.DSA_EVIDENCE_MIN_FREE_MB || 1000));

const allowedMime = new Set([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/svg+xml'
]);

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, evidenceUploadDir),
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname)}`;
        cb(null, unique);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: maxEvidenceFileBytes },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/') || allowedMime.has(file.mimetype)) {
            return cb(null, true);
        }
        cb(new Error('unsupported_file_type'));
    }
});

function db(req) { return req.database?.db; }
function asString(v) { return (v === undefined || v === null) ? null : String(v); }
function asNum(v, d) { const n = Number(v); return Number.isFinite(n) ? n : d; }

async function hasStorageCapacity() {
    if (!minFreeStorageMb) return true;
    try {
        const stats = await fs.promises.statfs(evidenceUploadDir);
        const freeBytes = Number(stats.bavail) * Number(stats.bsize);
        return freeBytes >= minFreeStorageMb * 1024 * 1024;
    } catch {
        return true;
    }
}

async function countFileEvidence(dbInstance, noticeId) {
    return new Promise((resolve, reject) => {
        dbInstance.get(
            `SELECT COUNT(*) AS count FROM ${tableEvidence.tableName} WHERE ${tableEvidence.columns.noticeId} = ? AND ${tableEvidence.columns.type} = ?`,
            [noticeId, 'file'],
            (err, row) => {
                if (err) return reject(err);
                resolve(row?.count || 0);
            }
        );
    });
}

const dayMs = 24 * 60 * 60 * 1000;
const statusBaseUrl = (process.env.PUBLIC_STATUS_BASE_URL || '').replace(/\/+$/, '') || null;

function buildStatusUrl(token) {
    if (!token || !statusBaseUrl) return null;
    return `${statusBaseUrl}/${token}`;
}

function resolveRange(range = '90d', now = Date.now()) {
    const map = {
        '30d': { label: 'Last 30 days', days: 30 },
        '90d': { label: 'Last 90 days', days: 90 },
        '365d': { label: 'Last 12 months', days: 365 },
        '7d': { label: 'Last 7 days', days: 7 }
    };
    if (range === 'all') {
        return { from: null, label: 'All time', value: 'all' };
    }
    const entry = map[range] || map['90d'];
    return {
        from: now - entry.days * dayMs,
        label: entry.label,
        value: range
    };
}

function dbAll(dbInstance, sql, params = []) {
    return new Promise((resolve, reject) => {
        dbInstance.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });
}

async function buildTransparencyStats(dbInstance, range) {
    const now = Date.now();
    const rangeInfo = resolveRange(range, now);
    const from = rangeInfo.from;

    const noticeWhere = from ? 'WHERE createdAt >= ?' : '';
    const decisionWhere = from ? 'WHERE decidedAt >= ?' : '';
    const signalWhere = from ? 'WHERE createdAt >= ?' : '';

    const notices = await dbAll(
        dbInstance,
        `SELECT id, status, category, reportedContentType, createdAt FROM tableDsaNotice ${noticeWhere}`,
        from ? [from] : []
    );

    const decisions = await dbAll(
        dbInstance,
        `SELECT noticeId, outcome, automatedUsed, decidedAt FROM tableDsaDecision ${decisionWhere}`,
        from ? [from] : []
    );

    const signals = await dbAll(
        dbInstance,
        `SELECT category, reportedContentType, createdAt FROM tableDsaSignal ${signalWhere}`,
        from ? [from] : []
    );

    const aggregate = (rows, key) => {
        const result = {};
        for (const row of rows) {
            let value = row[key];
            if (value === null || value === undefined || value === '') {
                value = 'Unspecified';
            }
            value = String(value);
            result[value] = (result[value] || 0) + 1;
        }
        return result;
    };

    const topEntries = (record, limit = 6) => {
        return Object.entries(record)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([category, count]) => ({ category, count }));
    };

    const noticeByStatus = aggregate(notices, 'status');
    const noticeByType = aggregate(notices, 'reportedContentType');
    const noticeCategories = aggregate(notices, 'category');

    const decisionByOutcome = aggregate(decisions, 'outcome');
    const decisionAutomated = decisions.reduce((acc, cur) => {
        const flag = Number(cur.automatedUsed) === 1 ? 'automated' : 'manual';
        acc[flag] = (acc[flag] || 0) + 1;
        return acc;
    }, { automated: 0, manual: 0 });

    const noticeMap = new Map();
    for (const n of notices) {
        noticeMap.set(n.id, n);
    }

    let totalDecisionDelay = 0;
    let decisionSamples = 0;
    for (const decision of decisions) {
        const notice = noticeMap.get(decision.noticeId);
        if (notice && Number.isFinite(notice.createdAt) && Number.isFinite(decision.decidedAt)) {
            const delay = Number(decision.decidedAt) - Number(notice.createdAt);
            if (delay >= 0) {
                totalDecisionDelay += delay;
                decisionSamples += 1;
            }
        }
    }

    const avgDecisionTimeMs = decisionSamples > 0 ? Math.round(totalDecisionDelay / decisionSamples) : 0;

    const trendMap = new Map();
    const bumpTrend = (month, field) => {
        if (!trendMap.has(month)) {
            trendMap.set(month, { month, notices: 0, decisions: 0 });
        }
        trendMap.get(month)[field] += 1;
    };

    for (const notice of notices) {
        const month = new Date(Number(notice.createdAt)).toISOString().slice(0, 7);
        bumpTrend(month, 'notices');
    }
    for (const decision of decisions) {
        const month = new Date(Number(decision.decidedAt)).toISOString().slice(0, 7);
        bumpTrend(month, 'decisions');
    }

    const trend = Array.from(trendMap.values()).sort((a, b) => a.month.localeCompare(b.month));

    const signalByType = aggregate(signals, 'reportedContentType');
    const signalCategories = aggregate(signals, 'category');

    return {
        range: {
            from,
            to: now,
            label: rangeInfo.label
        },
        notices: {
            total: notices.length,
            byStatus: noticeByStatus,
            byType: noticeByType,
            topCategories: topEntries(noticeCategories)
        },
        decisions: {
            total: decisions.length,
            byOutcome: decisionByOutcome,
            avgDecisionTimeMs,
            automated: {
                automated: decisionAutomated.automated || 0,
                manual: decisionAutomated.manual || 0
            }
        },
        signals: {
            total: signals.length,
            byType: signalByType,
            topCategories: topEntries(signalCategories)
        },
        trend
    };
}

function buildTransparencyCsv(stats) {
    const lines = [
        '"Metric","Value"',
        `"Range","${stats.range.label}"`,
        `"Total Notices","${stats.notices.total}"`,
        `"Total Decisions","${stats.decisions.total}"`,
        `"Average Decision Time","${stats.decisions.avgDecisionTimeMs}"`
    ];

    lines.push('"Notices by Status","count"');
    for (const [key, value] of Object.entries(stats.notices.byStatus || {})) {
        lines.push(`"${key}","${value}"`);
    }

    lines.push('"Decision Outcomes","count"');
    for (const [key, value] of Object.entries(stats.decisions.byOutcome || {})) {
        lines.push(`"${key}","${value}"`);
    }

    lines.push('"Top Notice Categories","count"');
    for (const entry of stats.notices.topCategories || []) {
        lines.push(`"${entry.category}","${entry.count}"`);
    }

    lines.push('"Signals by Type","count"');
    for (const [key, value] of Object.entries(stats.signals.byType || {})) {
        lines.push(`"${key}","${value}"`);
    }

    lines.push('"Trend Month","Notices","Decisions"');
    for (const entry of stats.trend || []) {
        lines.push(`"${entry.month}","${entry.notices}","${entry.decisions}"`);
    }

    return lines.join('\n');
}

/** Health */
router.get('/health', (_req, res) => res.json({ ok: true, service: 'dsa-backend' }));

/* ----------------------------- Helper ----------------------------- */
async function enablePublicMessage(messageId) {
    const url = `${process.env.BASE_URL}:${process.env.PORT}/digitalserviceact/enable/publicmessage/${encodeURIComponent(messageId)}`;
    const backendAudience = process.env.SERVICE_JWT_AUDIENCE_BACKEND || 'service.backend';
    const serviceToken = await signServiceJwt({ audience: backendAudience });
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${serviceToken}`,
            Accept: 'application/json'
        }
    });
    let json = null;
    try { json = await res.json(); } catch { /* noop */ }
    const ok = res.ok && (json?.status === 200 || json?.ok === true);
    return { ok, status: res.status, json };
}

function buildDecisionNotification({ notice, noticeId, outcome, automatedUsed }) {
    const verdict = outcome.replace(/_/g, ' ').toLowerCase();
    return {
        type: 'notice',
        event: 'notice_decided',
        contentId: notice?.contentId,
        category: notice?.category,
        reasonText: notice?.reasonText,
        reportedContentType: notice?.reportedContentType,
        caseId: noticeId,
        statusUrl: buildStatusUrl(notice?.publicToken),
        includeExcerpt: true,
        title: 'DSA decision available',
        bodySegments: [
            `We completed the review for DSA case #${noticeId}.`,
            `Outcome: ${verdict}.`,
            `Process type: ${automatedUsed ? 'automated' : 'manual'}.`
        ]
    };
}

function buildReporterNotice(notice) {
    if (!notice) return null;
    return {
        id: notice.id ?? null,
        reporterEmail: notice.reporterEmail ?? null,
        reporterName: notice.reporterName ?? null,
        contentId: notice.contentId ?? null,
        category: notice.category ?? null,
        reasonText: notice.reasonText ?? null,
        publicToken: notice.publicToken ?? null,
        reportedContentType: notice.reportedContentType ?? null
    };
}

function formatAppealOutcomeLabel(outcome) {
    if (!outcome) return 'Pending';
    const normalized = String(outcome).toUpperCase();
    switch (normalized) {
        case 'UPHELD':
            return 'Decision upheld';
        case 'REVISED':
            return 'Decision revised';
        case 'PARTIAL':
            return 'Partially revised';
        case 'WITHDRAWN':
            return 'Appeal withdrawn';
        default:
            return outcome;
    }
}

function buildAppealResolutionNotification({ notice, appeal, decisionOutcome, reason }) {
    if (!notice?.contentId) return null;

    const noticeId = notice.id;
    const segments = [
        `We reviewed the appeal for DSA case #${noticeId}.`,
        `Appeal outcome: ${formatAppealOutcomeLabel(appeal?.outcome)}.`
    ];

    if (decisionOutcome) {
        const readableDecision = decisionOutcome.replace(/_/g, ' ').toLowerCase();
        segments.push(`Original decision: ${readableDecision}.`);
    }

    if (reason) {
        segments.push(reason);
    }

    return {
        type: 'notice',
        event: 'notice_appeal_decided',
        contentId: notice.contentId,
        category: notice.category,
        reasonText: notice.reasonText,
        reportedContentType: notice.reportedContentType,
        caseId: noticeId,
        statusUrl: buildStatusUrl(notice.publicToken),
        includeExcerpt: true,
        title: 'DSA appeal outcome',
        bodySegments: segments
    };
}

function parseJsonField(raw) {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'object') return raw;
    try {
        return JSON.parse(raw);
    } catch {
        return { _raw: raw };
    }
}

function mapNotificationRow(row) {
    if (!row) return null;
    return {
        ...row,
        payload: parseJsonField(row.payload),
        meta: parseJsonField(row.meta)
    };
}


/* ----------------------------- Notices ----------------------------- */
router.get('/notices', (req, res, next) => {
    const _db = db(req); if (!_db) return next(apiError.internal('database_unavailable'));

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
            if (err) {
                const apiErr = apiError.internal('db_error');
                apiErr.detail = err.message;
                return next(apiErr);
            }
            res.json(rows);
        }
    );
});

router.get('/notices/:id', (req, res, next) => {
    const _db = db(req); if (!_db) return next(apiError.internal('database_unavailable'));
    tableNotice.getById(_db, req.params.id, (err, row) => {
        if (err) {
            const apiErr = apiError.internal('db_error');
            apiErr.detail = err.message;
            return next(apiErr);
        }
        if (!row) return next(apiError.notFound('not_found'));
        res.json(row);
    });
});

// Public status URL for a notice
router.get('/notices/:id/status-url', (req, res, next) => {
    const _db = db(req); if (!_db) return next(apiError.internal('database_unavailable'));
    tableNotice.getById(_db, req.params.id, (err, row) => {
        if (err) {
            const apiErr = apiError.internal('db_error');
            apiErr.detail = err.message;
            return next(apiErr);
        }
        if (!row) return next(apiError.notFound('not_found'));
        const statusUrl = buildStatusUrl(row.publicToken);
        if (!statusUrl) return next(apiError.notFound('status_unavailable'));
        res.json({ statusUrl });
    });
});

router.patch('/notices/:id/status', (req, res, next) => {
    const _db = db(req); if (!_db) return next(apiError.internal('database_unavailable'));

    const newStatus = String(req.body?.status || 'UNDER_REVIEW');
    const updatedAt = Date.now();
    const noticeId = String(req.params.id);

    tableNotice.getById(_db, noticeId, (lookupErr, noticeRow) => {
        if (lookupErr) {
            const apiErr = apiError.internal('db_error');
            apiErr.detail = lookupErr.message;
            return next(apiErr);
        }
        if (!noticeRow) return next(apiError.notFound('not_found'));

        tableNotice.updateStatus(_db, noticeId, newStatus, updatedAt, (err, ok) => {
            if (err) {
                const apiErr = apiError.internal('db_error');
                apiErr.detail = err.message;
                return next(apiErr);
            }
            if (!ok) return next(apiError.notFound('not_found'));

            // Audit
            const auditId = crypto.randomUUID();
            tableAudit.create(
                _db, auditId, 'notice', noticeId, 'status_change',
                `admin:${req.admin?.sub || 'unknown'}`, updatedAt, JSON.stringify({
                    status: newStatus,
                    previousStatus: noticeRow.status
                }),
                () => { }
            );

            if (noticeRow.status !== newStatus && newStatus === 'UNDER_REVIEW') {
                const reporterNotice = buildReporterNotice(noticeRow);
                void notifyContentOwner(req, {
                    type: 'notice',
                    event: 'notice_under_review',
                    contentId: noticeRow.contentId,
                    category: noticeRow.category,
                    reasonText: noticeRow.reasonText,
                    reportedContentType: noticeRow.reportedContentType,
                    caseId: noticeId,
                    statusUrl: buildStatusUrl(noticeRow.publicToken),
                    includeExcerpt: true,
                    title: 'DSA notice under review',
                    bodySegments: [
                        `Your DSA case #${noticeId} is now under review by our moderation team.`
                    ]
                });

                if (reporterNotice) {
                    void notifyReporter(req, {
                        event: 'notice_under_review',
                        notice: reporterNotice,
                        statusUrl: buildStatusUrl(noticeRow.publicToken)
                    });
                }
            }

            res.json({ ok: true });
        });
    });
});

/**
 * GET /dsa/backend/notices/:id/decision
 * Liefert die Entscheidung (falls vorhanden) zu einer Notice.
 */
router.get('/notices/:id/decision', (req, res, next) => {
    const _db = req.database?.db;
    if (!_db) return next(apiError.internal('database_unavailable'));

    const noticeId = req.params.id;
    if (!noticeId) return next(apiError.badRequest('missing_notice_id'));

    const tableDecision = require('../db/tableDsaDecision');

    tableDecision.getByNoticeId(_db, noticeId, (err, row) => {
        if (err) {
            const apiErr = apiError.internal('db_error');
            apiErr.detail = err.message;
            return next(apiErr);
        }
        if (!row) return next(apiError.notFound('decision_not_found'));
        res.json(row);
    });
});

/* ---------------------------- Decisions ---------------------------- */
router.post('/notices/:id/decision', (req, res, next) => {
    const _db = db(req); if (!_db) return next(apiError.internal('database_unavailable'));

    const id = crypto.randomUUID();
    const decidedAt = Date.now();
    const outcome = String(req.body?.outcome || 'NO_ACTION');
    const legalBasis = asString(req.body?.legalBasis);
    const tosBasis = asString(req.body?.tosBasis);
    const automatedUsed = req.body?.automatedUsed ? 1 : 0;
    const statement = asString(req.body?.statement);

    tableNotice.getById(_db, req.params.id, (lookupErr, noticeRow) => {
        if (lookupErr) {
            const apiErr = apiError.internal('db_error');
            apiErr.detail = lookupErr.message;
            return next(apiErr);
        }
        if (!noticeRow) return next(apiError.notFound('notice_not_found'));

        // Fetch previous decision (if any) to log a clear change event for timelines
        tableDecision.getByNoticeId(_db, req.params.id, (prevErr, prevDecisionRow) => {
            // ignore prevErr; just means no previous decision

            tableDecision.create(
            _db, id, req.params.id, outcome, legalBasis, tosBasis, automatedUsed,
            `admin:${req.admin?.sub || 'unknown'}`, decidedAt, statement,
            (err, row) => {
                if (err) {
                    const apiErr = apiError.internal('db_error');
                    apiErr.detail = err.message;
                    return next(apiErr);
                }

                // Status -> DECIDED
                tableNotice.updateStatus(_db, req.params.id, 'DECIDED', decidedAt, () => { });

                if (outcome === 'NO_ACTION' && noticeRow?.contentId) {
                    enablePublicMessage(noticeRow.contentId).catch(() => { });
                }

                // Audit
                const auditId = crypto.randomUUID();
                tableAudit.create(
                    _db, auditId, 'decision', id, 'create',
                    `admin:${req.admin?.sub || 'unknown'}`, decidedAt,
                    JSON.stringify({ noticeId: req.params.id, outcome }),
                    () => { }
                );

                // Create a NOTICE-level audit entry so public status timeline reflects decision creation/changes
                const noticeAuditAction = prevDecisionRow ? 'decision_change' : 'decision_create';
                const noticeAuditDetails = {
                    decisionId: id,
                    outcome,
                    previousOutcome: prevDecisionRow ? prevDecisionRow.outcome : null
                };
                tableAudit.create(
                    _db,
                    crypto.randomUUID(),
                    'notice',
                    req.params.id,
                    noticeAuditAction,
                    `admin:${req.admin?.sub || 'unknown'}`,
                    decidedAt,
                    JSON.stringify(noticeAuditDetails),
                    () => { }
                );

                if (noticeRow.status !== 'DECIDED') {
                    tableAudit.create(
                        _db,
                        crypto.randomUUID(),
                        'notice',
                        req.params.id,
                        'status_change',
                        `admin:${req.admin?.sub || 'unknown'}`,
                        decidedAt,
                        JSON.stringify({
                            status: 'DECIDED',
                            previousStatus: noticeRow.status
                        }),
                        () => { }
                    );
                }

                void notifyContentOwner(req, buildDecisionNotification({
                    notice: noticeRow,
                    noticeId: req.params.id,
                    outcome,
                    automatedUsed
                }));

                void notifyReporter(req, {
                    event: 'notice_decided',
                    notice: buildReporterNotice(noticeRow),
                    statusUrl: buildStatusUrl(noticeRow.publicToken),
                    extras: {
                        decisionOutcome: outcome,
                        statement
                    }
                });

                res.status(201).json(row); // { id }
            }
        );
        });
    });
});

/* ----------------------------- Appeals ----------------------------- */
router.get('/appeals', (req, res, next) => {
    const _db = db(req); if (!_db) return next(apiError.internal('database_unavailable'));

    const status = String(req.query?.status || 'open').toLowerCase();
    const noticeId = asString(req.query?.noticeId);
    const outcome = asString(req.query?.outcome);
    const limit = asNum(req.query?.limit, 100);
    const offset = asNum(req.query?.offset, 0);

    const whereParts = [];
    const params = [];

    if (status === 'open') {
        whereParts.push('ap.resolvedAt IS NULL');
    } else if (status === 'resolved') {
        whereParts.push('ap.resolvedAt IS NOT NULL');
    }

    if (noticeId) {
        whereParts.push('dec.noticeId = ?');
        params.push(noticeId);
    }

    if (outcome) {
        whereParts.push('ap.outcome = ?');
        params.push(outcome);
    }

    const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const sql = `
      SELECT
        ap.id,
        ap.decisionId,
        ap.filedBy,
        ap.filedAt,
        ap.arguments,
        ap.outcome,
        ap.resolvedAt,
        ap.reviewer,
        dec.noticeId,
        dec.outcome AS decisionOutcome,
        dec.decidedAt AS decisionDecidedAt,
        no.status AS noticeStatus,
        no.contentId AS noticeContentId,
        no.category AS noticeCategory,
        no.reasonText AS noticeReason,
        no.reportedContentType AS noticeContentType
      FROM tableDsaAppeal ap
      INNER JOIN tableDsaDecision dec ON dec.id = ap.decisionId
      INNER JOIN tableDsaNotice no ON no.id = dec.noticeId
      ${where}
      ORDER BY ap.filedAt DESC
      LIMIT ?
      OFFSET ?
    `;

    params.push(limit);
    params.push(offset);

    _db.all(sql, params, (err, rows) => {
        if (err) {
            const apiErr = apiError.internal('db_error');
            apiErr.detail = err.message;
            return next(apiErr);
        }
        res.json(rows || []);
    });
});

router.patch('/appeals/:id/resolution', (req, res, next) => {
    const _db = db(req); if (!_db) return next(apiError.internal('database_unavailable'));

    const appealId = String(req.params.id || '').trim();
    if (!appealId) return next(apiError.badRequest('invalid_appeal_id'));

    const outcome = asString(req.body?.outcome);
    const reviewer = asString(req.body?.reviewer) || `admin:${req.admin?.sub || 'unknown'}`;
    const reason = asString(req.body?.reason);
    const resolvedAt = outcome ? Date.now() : null;

    tableAppeal.updateResolution(_db, appealId, outcome, resolvedAt, reviewer, (err, ok) => {
        if (err) {
            const apiErr = apiError.internal('db_error');
            apiErr.detail = err.message;
            return next(apiErr);
        }
        if (!ok) return next(apiError.notFound('appeal_not_found'));

        const auditId = crypto.randomUUID();
        tableAudit.create(
            _db,
            auditId,
            'appeal',
            appealId,
            'appeal_resolve',
            `admin:${req.admin?.sub || 'unknown'}`,
            resolvedAt ?? Date.now(),
            JSON.stringify({ outcome, reviewer, reason }),
            () => { }
        );

        res.json({ ok: true });

        if (!outcome || !resolvedAt) {
            return;
        }

        const reasonText = typeof reason === 'string' && reason.trim().length > 0 ? reason.trim() : null;

        tableAppeal.getById(_db, appealId, (appealErr, appealRow) => {
            if (appealErr || !appealRow?.decisionId) {
                req.logger?.warn?.('Failed to load appeal for notification', { appealId, error: appealErr?.message });
                return;
            }

            tableDecision.getById(_db, appealRow.decisionId, (decisionErr, decisionRow) => {
                if (decisionErr || !decisionRow?.noticeId) {
                    req.logger?.warn?.('Failed to load decision for appeal notification', {
                        appealId,
                        decisionId: appealRow.decisionId,
                        error: decisionErr?.message
                    });
                    return;
                }

                tableNotice.getById(_db, decisionRow.noticeId, (noticeErr, noticeRow) => {
                    if (noticeErr || !noticeRow) {
                        req.logger?.warn?.('Failed to load notice for appeal notification', {
                            appealId,
                            decisionId: decisionRow.id,
                            noticeId: decisionRow.noticeId,
                            error: noticeErr?.message
                        });
                        return;
                    }

                    const notification = buildAppealResolutionNotification({
                        notice: noticeRow,
                        appeal: appealRow,
                        decisionOutcome: decisionRow.outcome,
                        reason: reasonText
                    });

                    if (notification) {
                        void notifyContentOwner(req, notification);
                    }

                    void notifyReporter(req, {
                        event: 'notice_appeal_decided',
                        notice: buildReporterNotice(noticeRow),
                        statusUrl: buildStatusUrl(noticeRow.publicToken),
                        extras: {
                            appealOutcome: appealRow?.outcome || outcome,
                            decisionOutcome: decisionRow.outcome,
                            reason: reasonText
                        }
                    });
                });
            });
        });
    });
});

/* ----------------------------- Evidence ----------------------------- */
router.post('/notices/:id/evidence', (req, res, next) => {
    const _db = db(req); if (!_db) return next(apiError.internal('database_unavailable'));

    upload.single('file')(req, res, (uploadErr) => {
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

        const id = crypto.randomUUID();
        const addedAt = Date.now();

        const hasFile = !!req.file;
        const type = hasFile ? 'file' : String(req.body?.type || 'url');
        const url = hasFile ? null : asString(req.body?.url);
        const hash = asString(req.body?.hash);

        if (type === 'url' && !url) {
            return next(apiError.badRequest('url_required'));
        }
        if (type === 'hash' && !hash) {
            return next(apiError.badRequest('hash_required'));
        }
        if (type === 'file' && !hasFile) {
            return next(apiError.badRequest('file_required'));
        }

        const fileName = hasFile ? req.file.originalname : null;
        const storedName = hasFile ? req.file.filename : null;

        const enforceFileLimits = async () => {
            if (!hasFile) return;
            if (!(await hasStorageCapacity())) {
                await fs.promises.unlink(path.join(evidenceUploadDir, storedName)).catch(() => { });
                throw apiError.custom(507, 'INSUFFICIENT_STORAGE', 'insufficient_storage');
            }
            const existingFileCount = await countFileEvidence(_db, req.params.id);
            if (existingFileCount >= maxEvidenceFiles) {
                await fs.promises.unlink(path.join(evidenceUploadDir, storedName)).catch(() => { });
                throw apiError.conflict('evidence_limit_reached');
            }
        };

        Promise.resolve()
            .then(enforceFileLimits)
            .then(() => {
                tableEvidence.create(
                    _db,
                    id,
                    req.params.id,
                    type,
                    url,
                    hash,
                    fileName,
                    storedName,
                    addedAt,
                    (err, row) => {
                        if (err) {
                            if (hasFile) {
                                fs.promises.unlink(path.join(evidenceUploadDir, storedName)).catch(() => { });
                            }
                            const apiErr = apiError.internal('db_error');
                            apiErr.detail = err.message;
                            return next(apiErr);
                        }

                        const auditId = crypto.randomUUID();
                        tableAudit.create(
                            _db, auditId, 'notice', req.params.id, 'evidence_add',
                            `admin:${req.admin?.sub || 'unknown'}`, addedAt,
                            JSON.stringify({ evidenceId: id, type }),
                            () => { }
                        );

                        res.status(201).json(row);
                    }
                );
            })
            .catch((err) => {
                if (err?.status || err?.statusCode) {
                    return next(err);
                }
                const apiErr = apiError.internal('db_error');
                apiErr.detail = err?.message || err;
                return next(apiErr);
            });
    });
});

/**
 * POST /notices/:id/evidence/screenshot
 * Body: { url: string; fullPage?: boolean; viewport?: { width?: number; height?: number } }
 * Captures a server-side screenshot of the given URL and stores it as file-evidence.
 * Notes:
 *  - Requires Playwright (or Playwright Chromium) to be installed in the backend runtime.
 *  - Applies basic SSRF protections (scheme/http(s), disallow local/priv ranges, localhost).
 */
router.post('/notices/:id/evidence/screenshot', async (req, res, next) => {
    const _db = db(req); if (!_db) return next(apiError.internal('database_unavailable'));

    const rawUrl = asString(req.body?.url);
    const fullPage = Boolean(req.body?.fullPage ?? true);
    const viewport = req.body?.viewport || {};
    const width = Number.isFinite(Number(viewport.width)) ? Number(viewport.width) : 1280;
    const height = Number.isFinite(Number(viewport.height)) ? Number(viewport.height) : 800;
    const waitSelector = asString(req.body?.waitSelector); // optional: CSS selector to wait for
    const elementSelector = asString(req.body?.elementSelector); // optional: screenshot a specific element
    const clickSelectors = Array.isArray(req.body?.clickSelectors) ? req.body.clickSelectors.filter(s => typeof s === 'string') : [];
    const delayMs = Number.isFinite(Number(req.body?.delayMs)) ? Number(req.body.delayMs) : 0;
    const cookies = Array.isArray(req.body?.cookies) ? req.body.cookies : null; // [{ name, value, domain, path }]
    const acceptLanguage = asString(req.body?.acceptLanguage) || 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7';

    if (!rawUrl) return next(apiError.badRequest('url_required'));

    let u;
    try { u = new URL(rawUrl); } catch { return next(apiError.badRequest('invalid_url')); }
    if (!/^https?:$/.test(u.protocol)) {
        return next(apiError.badRequest('unsupported_scheme'));
    }
    const hostLc = u.hostname.toLowerCase();
    // naive SSRF guards (IP-literals and localhost names)
    const isPrivateIp = (host) => {
        // IPv4 patterns only (basic). IPv6 localhost also blocked.
        if (host === 'localhost' || host === '::1') return true;
        const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
        if (!m) return false;
        const a = m.slice(1).map(n => Number(n));
        if (a[0] === 10) return true;
        if (a[0] === 127) return true;
        if (a[0] === 169 && a[1] === 254) return true; // link-local
        if (a[0] === 192 && a[1] === 168) return true;
        if (a[0] === 172 && a[1] >= 16 && a[1] <= 31) return true;
        return false;
    };
    if (isPrivateIp(hostLc)) {
        return next(apiError.badRequest('blocked_destination'));
    }

    try {
        const existingFileCount = await countFileEvidence(_db, req.params.id);
        if (existingFileCount >= maxEvidenceFiles) {
            return next(apiError.conflict('evidence_limit_reached'));
        }
        if (!(await hasStorageCapacity())) {
            return next(apiError.custom(507, 'INSUFFICIENT_STORAGE', 'insufficient_storage'));
        }
    } catch (err) {
        const apiErr = apiError.internal('db_error');
        apiErr.detail = err?.message || err;
        return next(apiErr);
    }

    // Lazy-load Playwright. Try full package then chromium-only.
    let pw;
    try {
        pw = require('playwright');
    } catch (playwrightError) {
        req.logger?.warn('Falling back to playwright-chromium', { error: playwrightError?.message });
        try {
            pw = require('playwright-chromium');
        } catch (chromiumError) {
            req.logger?.error('Playwright not installed', { error: chromiumError?.message });
            const apiErr = apiError.custom(501, 'NOT_IMPLEMENTED', 'screenshot_unavailable');
            apiErr.detail = 'playwright not installed';
            return next(apiErr);
        }
    }

    const now = Date.now();
    const id = crypto.randomUUID();
    const storedName = `${now}-${id}.png`;
    const outPath = path.join(evidenceUploadDir, storedName);

    let browser;
    try {
        browser = await pw.chromium.launch({
            args: ['--no-sandbox', '--disable-dev-shm-usage'],
            headless: true
        });
        const context = await browser.newContext({
            viewport: { width, height },
            locale: 'de-DE',
            userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36',
        });

        if (cookies && cookies.length) {
            try {
                await context.addCookies(cookies.map(c => ({
                    name: String(c.name),
                    value: String(c.value),
                    domain: c.domain ? String(c.domain) : u.hostname,
                    path: c.path ? String(c.path) : '/',
                    httpOnly: Boolean(c.httpOnly ?? false),
                    secure: Boolean(c.secure ?? true),
                    sameSite: c.sameSite || 'Lax'
                })));
            } catch { /* ignore cookie errors */ }
        }

        await context.setExtraHTTPHeaders({ 'Accept-Language': acceptLanguage });
        const page = await context.newPage();
        await page.goto(u.toString(), { waitUntil: 'networkidle', timeout: 25000 });

        // Optional explicit wait for a selector that indicates main content
        if (waitSelector) {
            try { await page.waitForSelector(waitSelector, { timeout: 5000 }); } catch { /* ignore */ }
        }

        // Best-effort: try to accept cookie banners (common button texts), also in iframes
        const tryAcceptConsent = async () => {
            const labels = [
                /alle akzeptieren/i,
                /ich stimme zu/i,
                /akzeptieren/i,
                /accept all/i,
                /i agree/i,
                /accept/i
            ];
            const frames = page.frames();
            for (const frame of frames) {
                for (const re of labels) {
                    try {
                        const btnByRole = frame.getByRole ? frame.getByRole('button', { name: re }) : null;
                        if (btnByRole && await btnByRole.count().catch(() => 0)) {
                            await btnByRole.first().click({ timeout: 1500 }).catch(() => { });
                        }
                        const byText = frame.locator ? frame.locator(`text=${re.source.replace(/\//g, '')}`) : null;
                        if (byText && await byText.count().catch(() => 0)) {
                            await byText.first().click({ timeout: 1500 }).catch(() => { });
                        }
                    } catch { /* ignore */ }
                }
            }
        };

        await tryAcceptConsent();

        // Optional explicit clicks provided by client
        for (const sel of clickSelectors) {
            try {
                // Click within main page and all frames
                await page.locator(sel).first().click({ timeout: 1500 }).catch(() => { });
                for (const frame of page.frames()) {
                    await frame.locator(sel).first().click({ timeout: 1500 }).catch(() => { });
                }
            } catch { /* ignore */ }
        }

        if (delayMs > 0 && delayMs < 10000) {
            await page.waitForTimeout(delayMs);
        }

        if (elementSelector) {
            try {
                const el = page.locator(elementSelector).first();
                await el.waitFor({ timeout: 5000 }).catch(() => { });
                await el.screenshot({ path: outPath });
            } catch {
                await page.screenshot({ path: outPath, fullPage });
            }
        } else {
            await page.screenshot({ path: outPath, fullPage });
        }
        try {
            const stat = await fs.promises.stat(outPath);
            if (stat.size > maxEvidenceFileBytes) {
                await fs.promises.unlink(outPath).catch(() => { });
                const apiErr = apiError.payloadTooLarge('file_too_large');
                apiErr.maxBytes = maxEvidenceFileBytes;
                return next(apiErr);
            }
        } catch {
            await fs.promises.unlink(outPath).catch(() => { });
            const apiErr = apiError.internal('file_access_failed');
            return next(apiErr);
        }
        await context.close();
    } catch (err) {
        if (browser) {
            try {
                await browser.close();
            } catch (closeError) {
                req.logger?.warn('playwright close failed', { error: closeError?.message });
            }
        }
        // cleanup any partial file
        fs.promises.unlink(outPath).catch(() => { });
        const apiErr = apiError.badGateway('screenshot_failed');
        apiErr.detail = err?.message || String(err);
        return next(apiErr);
    }

    try {
        await browser.close();
    } catch (closeError) {
        req.logger?.warn('playwright close failed', { error: closeError?.message });
    }

    // Store as file evidence
    const fileName = `screenshot-${u.hostname}.png`;
    const addedAt = now;
    tableEvidence.create(
        _db,
        id,
        req.params.id,
        'file',
        null,
        null,
        fileName,
        storedName,
        addedAt,
        (err, row) => {
            if (err) {
                fs.promises.unlink(outPath).catch(() => { });
                const apiErr = apiError.internal('db_error');
                apiErr.detail = err.message;
                return next(apiErr);
            }

            const auditId = crypto.randomUUID();
            tableAudit.create(
                _db, auditId, 'notice', req.params.id, 'evidence_add',
                `admin:${req.admin?.sub || 'unknown'}`, addedAt,
                JSON.stringify({ evidenceId: id, type: 'file', origin: 'screenshot', url: u.toString() }),
                () => { }
            );

            res.status(201).json(row);
        }
    );
});

router.get('/notices/:id/evidence', (req, res, next) => {
    const _db = db(req); if (!_db) return next(apiError.internal('database_unavailable'));

    tableEvidence.listByNotice(
        _db,
        { noticeId: req.params.id, type: asString(req.query?.type), limit: asNum(req.query.limit, 100), offset: asNum(req.query.offset, 0) },
        (err, rows) => {
            if (err) {
                const apiErr = apiError.internal('db_error');
                apiErr.detail = err.message;
                return next(apiErr);
            }
            res.json(rows);
        }
    );
});

router.get('/evidence/:id/download', (req, res, next) => {
    const _db = db(req); if (!_db) return next(apiError.internal('database_unavailable'));

    tableEvidence.getById(_db, String(req.params.id), (err, row) => {
        if (err) {
            const apiErr = apiError.internal('db_error');
            apiErr.detail = err.message;
            return next(apiErr);
        }
        if (!row || row.type !== 'file' || !row.filePath) {
            return next(apiError.notFound('file_not_found'));
        }

        const safeFile = path.basename(row.filePath);
        const fileOnDisk = path.join(evidenceUploadDir, safeFile);

        fs.access(fileOnDisk, fs.constants.R_OK, (accessErr) => {
            if (accessErr) return next(apiError.notFound('file_not_found'));
            res.download(fileOnDisk, row.fileName || safeFile, (downloadErr) => {
                if (downloadErr && !res.headersSent) {
                    return next(apiError.internal('download_failed'));
                }
            });
        });
    });
});

/* --------------------------- Notifications --------------------------- */
router.post('/notifications', async (req, res, next) => {
    const _db = db(req); if (!_db) return next(apiError.internal('database_unavailable'));

    const sentAt = Date.now();
    const noticeId = asString(req.body?.noticeId);
    const decisionId = asString(req.body?.decisionId);
    const stakeholder = String(req.body?.stakeholder || 'reporter'); // reporter|uploader|other
    const channel = String(req.body?.channel || 'inapp');            // email|inapp|webhook
    const payload = req.body?.payload ?? {};
    const meta = req.body?.meta ?? {};
    const actor = `admin:${req.admin?.sub || 'unknown'}`;

    const id = await recordNotification(_db, {
        noticeId,
        decisionId,
        stakeholder,
        channel,
        payload,
        meta,
        sentAt,
        auditActor: actor,
        logger: req.logger
    });

    if (!id) return next(apiError.internal('db_error'));

    // Optional immediate delivery for email notifications
    try {
        if (channel === 'email') {
            const mail = payload.mail || payload;
            const to = mail.to || payload.to;
            const subject = mail.subject || payload.subject || 'DSA update';
            const text = mail.text || payload.text || (payload.body || '');
            const html = mail.html || payload.html || undefined;
            const from = mail.from || payload.from || undefined;

            if (to && subject && (text || html)) {
                const result = await sendMail({ to, subject, text, html, from, logger: req.logger });
                const deliveredMeta = {
                    source: 'create',
                    sentAt: Date.now(),
                    success: result.success,
                    event: meta?.event || payload.event || null,
                    error: result.success ? null : String(result.error?.message || result.error || 'unknown_error'),
                    provider: result.info ? { messageId: result.info.messageId ?? result.info?.response ?? null } : null,
                    createOf: id
                };
                await recordNotification(_db, {
                    noticeId: noticeId ?? null,
                    decisionId: decisionId ?? null,
                    stakeholder,
                    channel: 'email',
                    payload: { to, subject, text, html, from, event: payload.event || meta?.event || null },
                    meta: deliveredMeta,
                    sentAt: Date.now(),
                    auditActor: actor,
                    logger: req.logger
                });
            }
        }
    } catch (e) {
        // Do not fail the API request if delivery attempt fails; UI can use Resend flow.
        req.logger?.warn?.('Immediate email delivery failed on create', { error: String(e?.message || e) });
    }

    res.status(201).json({ id });
});

router.get('/notifications', (req, res, next) => {
    const _db = db(req); if (!_db) return next(apiError.internal('database_unavailable'));

    const opts = {
        noticeId: asString(req.query.noticeId ?? undefined) || undefined,
        decisionId: asString(req.query.decisionId ?? undefined) || undefined,
        channel: asString(req.query.channel ?? undefined) || undefined,
        stakeholder: asString(req.query.stakeholder ?? undefined) || undefined,
        limit: asNum(req.query.limit, 200),
        offset: asNum(req.query.offset, 0)
    };

    tableNotification.list(_db, opts, (err, rows) => {
        if (err) {
            const apiErr = apiError.internal('db_error');
            apiErr.detail = err.message;
            return next(apiErr);
        }

        const mapped = (rows || []).map(mapNotificationRow);
        const q = asString(req.query.q);
        const filtered = q
            ? mapped.filter((row) => {
                const needle = q.toLowerCase();
                const payloadText = JSON.stringify(row.payload || {}).toLowerCase();
                const metaText = JSON.stringify(row.meta || {}).toLowerCase();
                return (row.stakeholder || '').toLowerCase().includes(needle) ||
                    (row.channel || '').toLowerCase().includes(needle) ||
                    payloadText.includes(needle) ||
                    metaText.includes(needle);
            })
            : mapped;

        if (String(req.query.format || '').toLowerCase() === 'csv') {
            const header = 'id,sentAt,stakeholder,channel,noticeId,decisionId,status,event\n';
            const lines = filtered.map((row) => {
                const status = row.meta?.success === false ? 'failed' : 'sent';
                const event = row.meta?.event || row.payload?.event || '';
                return [
                    row.id,
                    row.sentAt,
                    row.stakeholder,
                    row.channel,
                    row.noticeId || '',
                    row.decisionId || '',
                    status,
                    event
                ].map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',');
            });
            const csv = header + lines.join('\n');
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="dsa-notifications.csv"');
            return res.send(csv);
        }

        res.json(filtered);
    });
});

router.get('/notifications/:id', (req, res, next) => {
    const _db = db(req); if (!_db) return next(apiError.internal('database_unavailable'));

    tableNotification.getById(_db, String(req.params.id), (err, row) => {
        if (err) {
            const apiErr = apiError.internal('db_error');
            apiErr.detail = err.message;
            return next(apiErr);
        }
        if (!row) return next(apiError.notFound('not_found'));
        res.json(mapNotificationRow(row));
    });
});

router.post('/notifications/:id/resend', async (req, res, next) => {
    const _db = db(req); if (!_db) return next(apiError.internal('database_unavailable'));

    const notificationId = String(req.params.id);

    const row = await new Promise((resolve, reject) => {
        tableNotification.getById(_db, notificationId, (err, value) => {
            if (err) return reject(err);
            resolve(value || null);
        });
    }).catch((error) => {
        const apiErr = apiError.internal('db_error');
        apiErr.detail = error.message;
        next(apiErr);
        return null;
    });
    if (row === null) return; // response already sent above
    if (!row) return next(apiError.notFound('not_found'));

    const mapped = mapNotificationRow(row);
    if ((mapped.meta?.success === false) && req.body?.skipFailed === true) {
        return next(apiError.conflict('notification_failed_initially'));
    }

    const actor = `admin:${req.admin?.sub || 'unknown'}`;
    const baseMeta = mapped.meta || {};
    const payload = mapped.payload || {};
    const resentAt = Date.now();
    let resendSuccess = false;
    let meta = null;

    if (mapped.channel === 'email') {
        const mail = payload.mail || payload;
        const to = mail.to || payload.to;
        const subject = mail.subject || payload.subject;
        const text = mail.text || payload.text;
        const html = mail.html || payload.html;
        const from = mail.from || payload.from || undefined;

        if (!to || !subject || (!text && !html)) {
            return next(apiError.badRequest('invalid_mail_payload'));
        }

        const result = await sendMail({ to, subject, text, html, from, logger: req.logger });
        resendSuccess = result.success;
        meta = {
            source: 'resend',
            resentAt,
            success: result.success,
            event: baseMeta?.event || payload.event || null,
            error: result.success ? null : String(result.error?.message || result.error || 'unknown_error'),
            provider: result.info ? { messageId: result.info.messageId ?? result.info?.response ?? null } : null,
            resendOf: notificationId
        };

        await recordNotification(_db, {
            noticeId: mapped.noticeId ?? null,
            decisionId: mapped.decisionId ?? null,
            stakeholder: mapped.stakeholder || 'reporter',
            channel: 'email',
            payload: { to, subject, text, html, from, event: payload.event || baseMeta?.event || null },
            meta,
            sentAt: resentAt,
            auditActor: actor,
            logger: req.logger
        });
    } else if (mapped.channel === 'inapp') {
        const destination = payload.destination;
        const title = payload.title || 'DSA update';
        const body = payload.body || ''; 
        const metadata = payload.metadata || {};

        if (!destination || !body) {
            return next(apiError.badRequest('invalid_inapp_payload'));
        }

        if (!process.env.BASE_URL || !process.env.PORT) {
            return next(apiError.internal('notification_service_unavailable'));
        }

        const deliveryPayload = {
            userId: destination,
            title,
            body,
            category: 'dsa',
            source: 'digital-service-act',
            metadata
        };

        try {
            const backendAudience = process.env.SERVICE_JWT_AUDIENCE_BACKEND || 'service.backend';
            const serviceToken = await signServiceJwt({ audience: backendAudience });
            const response = await axios.post(
                `${process.env.BASE_URL}:${process.env.PORT}/notification/create`,
                deliveryPayload,
                {
                    headers: {
                        Authorization: `Bearer ${serviceToken}`,
                        Accept: 'application/json'
                    },
                    timeout: 5000,
                    validateStatus: () => true
                }
            );

            resendSuccess = response.status >= 200 && response.status < 300;
            meta = {
                source: 'resend',
                resentAt,
                success: resendSuccess,
                event: baseMeta?.event || payload.event || null,
                responseStatus: response.status,
                error: resendSuccess ? null : JSON.stringify(response.data || null),
                resendOf: notificationId
            };
        } catch (err) {
            resendSuccess = false;
            meta = {
                source: 'resend',
                resentAt,
                success: false,
                event: baseMeta?.event || payload.event || null,
                error: String(err?.message || err),
                resendOf: notificationId
            };
        }

        await recordNotification(_db, {
            noticeId: mapped.noticeId ?? null,
            decisionId: mapped.decisionId ?? null,
            stakeholder: mapped.stakeholder || 'uploader',
            channel: 'inapp',
            payload: { ...payload, event: payload.event || baseMeta?.event || null },
            meta,
            sentAt: resentAt,
            auditActor: actor,
            logger: req.logger
        });
    } else {
        const apiErr = apiError.badRequest('resend_not_supported');
        apiErr.channel = mapped.channel;
        return next(apiErr);
    }

    res.json({ success: resendSuccess });
});

/* ------------------------------- Audit ------------------------------- */
router.get('/audit/:entityType/:entityId', (req, res, next) => {
    const _db = db(req); if (!_db) return next(apiError.internal('database_unavailable'));

    tableAudit.listByEntity(
        _db,
        { entityType: String(req.params.entityType), entityId: String(req.params.entityId), limit: asNum(req.query.limit, 200), offset: asNum(req.query.offset, 0) },
        (err, rows) => {
            if (err) {
                const apiErr = apiError.internal('db_error');
                apiErr.detail = err.message;
                return next(apiErr);
            }
            res.json(rows);
        }
    );
});

/** -------------------- STATS: NOTICES -------------------- **/
router.get('/stats/notices', (req, res, next) => {
    const _db = db(req);
    if (!_db) return next(apiError.internal('database_unavailable'));

    tableNotice.stats(_db, (err, result) => {
        if (err) {
            const apiErr = apiError.internal('db_error');
            apiErr.detail = err.message;
            return next(apiErr);
        }
        res.json(result); // { total, open, byStatus }
    });
});

/** -------------------- STATS: APPEALS -------------------- **/
router.get('/stats/appeals', (req, res, next) => {
    const _db = db(req);
    if (!_db) return next(apiError.internal('database_unavailable'));

    tableAppeal.stats(_db, (err, result) => {
        if (err) {
            const apiErr = apiError.internal('db_error');
            apiErr.detail = err.message;
            return next(apiErr);
        }
        res.json(result);
    });
});

/** -------------------- STATS: SIGNALS -------------------- **/
router.get('/stats/signals', (req, res, next) => {
    const _db = db(req);
    if (!_db) return next(apiError.internal('database_unavailable'));

    tableSignal.stats(_db, (err, result) => {
        if (err) {
            const apiErr = apiError.internal('db_error');
            apiErr.detail = err.message;
            return next(apiErr);
        }
        res.json(result); // { total, last24h, byType }
    });
});

/* -------------------------- Transparency -------------------------- */
router.get('/transparency/stats', async (req, res, next) => {
    const _db = db(req);
    if (!_db) return next(apiError.internal('database_unavailable'));

    try {
        const range = String(req.query.range || '90d');
        const stats = await buildTransparencyStats(_db, range);
        res.json(stats);
    } catch (err) {
        const apiErr = apiError.internal('db_error');
        apiErr.detail = err instanceof Error ? err.message : String(err);
        return next(apiErr);
    }
});

const transparencyPresets = [
    { id: 'last-30-days', title: 'Transparency report (last 30 days)', range: '30d' },
    { id: 'last-90-days', title: 'Transparency report (last 90 days)', range: '90d' },
    { id: 'year-to-date', title: 'Transparency report (last 12 months)', range: '365d' }
];

router.get('/transparency/reports', (req, res) => {
    const now = Date.now();
    const requestedRange = String(req.query.range || '90d');

    const reports = transparencyPresets.map((preset) => {
        const info = resolveRange(preset.range, now);
        return {
            id: preset.id,
            title: preset.title,
            description: null,
            format: 'csv',
            generatedAt: now,
            sizeBytes: null,
            period: {
                from: info.from,
                to: now,
                label: info.label
            },
            rangeKey: preset.range
        };
    });

    // ensure requested range is present as first entry
    if (!reports.some(r => r.rangeKey === requestedRange)) {
        const info = resolveRange(requestedRange, now);
        reports.unshift({
            id: `custom-${requestedRange}`,
            title: `Transparency report (${info.label})`,
            description: null,
            format: 'csv',
            generatedAt: now,
            sizeBytes: null,
            period: {
                from: info.from,
                to: now,
                label: info.label
            },
            rangeKey: requestedRange
        });
    }

    res.json(reports);
});

router.get('/transparency/reports/:id/download', async (req, res, next) => {
    const _db = db(req);
    if (!_db) return next(apiError.internal('database_unavailable'));

    const preset = transparencyPresets.find(p => p.id === req.params.id);
    const rangeKey = preset?.range || (req.params.id.startsWith('custom-') ? req.params.id.replace('custom-', '') : null);
    if (!rangeKey) {
        return next(apiError.notFound('report_not_found'));
    }

    try {
        const stats = await buildTransparencyStats(_db, rangeKey);
        const csv = buildTransparencyCsv(stats);
        const filename = `transparency-${req.params.id}-${new Date().toISOString().slice(0, 10)}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
    } catch (err) {
        const apiErr = apiError.internal('report_generation_failed');
        apiErr.detail = err instanceof Error ? err.message : String(err);
        return next(apiErr);
    }
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
router.get('/signals', (req, res, next) => {
    const _db = db(req); if (!_db) return next(apiError.internal('database_unavailable'));

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
        if (err) {
            const apiErr = apiError.internal('db_error');
            apiErr.detail = err.message;
            return next(apiErr);
        }
        res.json(rows);
    });
});

/**
 * GET /signals/:id
 */
router.get('/signals/:id', (req, res, next) => {
    const _db = db(req); if (!_db) return next(apiError.internal('database_unavailable'));

    tableSignal.getById(_db, String(req.params.id), (err, row) => {
        if (err) {
            const apiErr = apiError.internal('db_error');
            apiErr.detail = err.message;
            return next(apiErr);
        }
        if (!row) return next(apiError.notFound('not_found'));
        res.json(row);
    });
});

// Public status URL for a signal
router.get('/signals/:id/status-url', (req, res, next) => {
    const _db = db(req); if (!_db) return next(apiError.internal('database_unavailable'));
    tableSignal.getById(_db, String(req.params.id), (err, row) => {
        if (err) {
            const apiErr = apiError.internal('db_error');
            apiErr.detail = err.message;
            return next(apiErr);
        }
        if (!row) return next(apiError.notFound('not_found'));
        const statusUrl = buildStatusUrl(row.publicToken);
        if (!statusUrl) return next(apiError.notFound('status_unavailable'));
        res.json({ statusUrl });
    });
});

/**
 * POST /signals/:id/promote
 * - erzeugt ein Notice (Status: RECEIVED)
 * - audit: signal:promote, notice:create
 * - **löscht** das Signal + audit: signal:delete (mit Snapshot)
 */
router.post('/signals/:id/promote', (req, res, next) => {
    const _db = db(req);
    if (!_db) return next(apiError.internal('database_unavailable'));

    const signalId = String(req.params.id);
    const now = Date.now();

    tableSignal.getById(_db, signalId, (err, sig) => {
        if (err) {
            const apiErr = apiError.internal('db_error');
            apiErr.detail = err.message;
            return next(apiErr);
        }
        if (!sig) return next(apiError.notFound('signal_not_found'));

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

        const noticeToken = sig.publicToken || crypto.randomBytes(24).toString('base64url');
        const noticeTokenCreatedAt = sig.publicTokenCreatedAt || now;

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
            noticeToken,
            noticeTokenCreatedAt,
            (err2) => {
                if (err2) {
                    const apiErr = apiError.internal('db_error');
                    apiErr.detail = err2.message;
                    return next(apiErr);
                }

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

                // **Signal ausblenden** (soft dismiss) + Audit mit Snapshot
                tableSignal.dismiss(_db, signalId, now, (err3, ok) => {
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

                    void notifyContentOwner(req, {
                        type: 'notice',
                        event: 'signal_promoted',
                        contentId,
                        caseId: noticeId,
                        category,
                        reasonText,
                        reportedContentType,
                        statusUrl: buildStatusUrl(noticeToken),
                        bodySegments: [
                            'We escalated a DSA signal into a formal notice for your message.'
                        ],
                        includeExcerpt: true,
                        title: 'DSA notice opened'
                    });

                    void notifyReporter(req, {
                        event: 'notice_received',
                        notice: {
                            id: noticeId,
                            reporterEmail: reporterEmail,
                            reporterName: reporterName,
                            contentId,
                            category,
                            reasonText,
                            publicToken: noticeToken,
                            reportedContentType
                        },
                        statusUrl: buildStatusUrl(noticeToken)
                    });

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
router.delete('/signals/:id', (req, res, next) => {
    const _db = db(req);
    if (!_db) return next(apiError.internal('database_unavailable'));

    const id = String(req.params.id);
    const reason = (req.body && typeof req.body.reason === 'string') ? req.body.reason : 'dismissed_by_admin';
    const now = Date.now();

    // Für Audit Snapshot holen
    tableSignal.getById(_db, id, async (e1, sig) => {
        if (e1) {
            const apiErr = apiError.internal('db_error');
            apiErr.detail = e1.message;
            return next(apiErr);
        }
        if (!sig) return next(apiError.notFound('not_found'));

        try {
            const resp = await enablePublicMessage(String(sig.contentId));
            if (!resp.ok) {
                const apiErr = apiError.badGateway('enable_failed');
                apiErr.upstreamStatus = resp.status;
                apiErr.upstream = resp.json;
                return next(apiErr);
            }
        } catch (e) {
            const apiErr = apiError.badGateway('enable_failed');
            apiErr.detail = String(e?.message || e);
            return next(apiErr);
        }

        // Soft-dismiss the signal to keep status page accessible via token
        tableSignal.dismiss(_db, id, now, (e2, ok) => {
            if (e2) {
                const apiErr = apiError.internal('db_error');
                apiErr.detail = e2.message;
                return next(apiErr);
            }
            if (!ok) return next(apiError.notFound('not_found'));

            // Audit: Signal delete + Snapshot
            const auditId = crypto.randomUUID();
            tableAudit.create(
                _db, auditId, 'signal', id, 'delete',
                `admin:${req.admin?.sub || 'unknown'}`, now,
                JSON.stringify({ reason, snapshot: sig }),
                () => { }
            );

            const readableReason = reason === 'dismissed_by_admin'
                ? 'Dismissed by moderation team'
                : reason;

            void notifyContentOwner(req, {
                type: 'signal',
                event: 'signal_dismissed',
                contentId: sig.contentId,
                category: sig.category,
                reasonText: readableReason,
                reportedContentType: sig.reportedContentType,
                includeExcerpt: true,
                title: 'DSA signal resolved',
                caseId: id,
                bodySegments: [
                    `We reviewed DSA signal Case #${id} and did not find a violation of our policies.`,
                    'Your message has been made visible again.'
                ]
            });

            res.json({ deleted: true });
        });
    });
});

// dsa-backend routes (Ausschnitt)
router.get('/audit', (req, res, next) => {
    const _db = db(req);
    if (!_db) return next(apiError.internal('database_unavailable'));

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
        if (err) {
            const apiErr = apiError.internal('db_error');
            apiErr.detail = err.message;
            return next(apiErr);
        }
        res.json(rows);
    });
});

module.exports = router;
