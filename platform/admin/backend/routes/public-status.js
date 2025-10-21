const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const tableNotice = require('../db/tableDsaNotice');
const tableSignal = require('../db/tableDsaSignal');
const tableDecision = require('../db/tableDsaDecision');
const tableEvidence = require('../db/tableDsaEvidence');
const tableAudit = require('../db/tableDsaAuditLog');
const tableAppeal = require('../db/tableDsaAppeal');
const multer = require('multer');
const { notifyContentOwner } = require('../utils/notifyContentOwner');
const { notifyReporter } = require('../utils/notifyReporter');

const evidenceUploadDir = path.join(__dirname, '..', 'uploads', 'evidence');

const router = express.Router();
router.use(express.json({ limit: '2mb' }));

const statusBaseUrl = (process.env.PUBLIC_STATUS_BASE_URL || '').replace(/\/+$/, '') || null;

function buildStatusUrl(token) {
  if (!token || !statusBaseUrl) return null;
  return `${statusBaseUrl}/${token}`;
}

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
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || allowedMime.has(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error('unsupported_file_type'));
  }
});

function db(req) {
  return req.database?.db;
}

function toPromise(fn, ...params) {
  return new Promise((resolve, reject) => {
    fn(...params, (err, result) => {
      if (err) reject(err);
      else resolve(result || null);
    });
  });
}

function parseDetails(entry) {
  if (!entry?.detailsJson) return null;
  try { return JSON.parse(entry.detailsJson); }
  catch { return { _raw: entry.detailsJson }; }
}

router.get('/status/:token', async (req, res) => {
  const token = String(req.params.token || '').trim();
  const _db = db(req);
  if (!_db || !token) return res.status(400).json({ error: 'invalid_token' });

  try {
    let notice = await toPromise(tableNotice.getByPublicToken, _db, token);
    let signal = null;

    if (!notice) {
      signal = await toPromise(tableSignal.getByPublicToken, _db, token);
      if (!signal) {
        return res.status(404).json({ error: 'not_found' });
      }
    }

    if (notice) {
      const decision = await toPromise(tableDecision.getByNoticeId, _db, notice.id).catch(() => null);
      const evidence = await new Promise((resolve, reject) => {
        tableEvidence.listByNotice(_db, { noticeId: notice.id }, (err, rows) => err ? reject(err) : resolve(rows || []));
      });
      const appeals = decision ? await new Promise((resolve, reject) => {
        tableAppeal.listByDecision(_db, { decisionId: decision.id }, (err, rows) => err ? reject(err) : resolve(rows || []));
      }) : [];
      const audit = await new Promise((resolve, reject) => {
        tableAudit.listByEntity(_db, { entityType: 'notice', entityId: notice.id, limit: 200, offset: 0 }, (err, rows) => err ? reject(err) : resolve(rows || []));
      });

      tableAudit.create(
        _db,
        crypto.randomUUID(),
        'notice',
        notice.id,
        'status_view',
        `public:${req.ip || 'unknown'}`,
        Date.now(),
        JSON.stringify({ token, userAgent: req.headers['user-agent'] || null }),
        () => { }
      );

      return res.json({
        entityType: 'notice',
        notice,
        decision: decision || null,
        evidence: evidence.map(ev => ({
          id: ev.id,
          type: ev.type,
          url: ev.url,
          hash: ev.hash,
          fileName: ev.fileName,
          addedAt: ev.addedAt
        })),
        appeals: (appeals || []).map(ap => ({
          id: ap.id,
          filedBy: ap.filedBy,
          filedAt: ap.filedAt,
          arguments: ap.arguments,
          outcome: ap.outcome,
          resolvedAt: ap.resolvedAt,
          reviewer: ap.reviewer
        })),
        audit: audit.map(entry => ({
          id: entry.id,
          action: entry.action,
          actor: entry.actor,
          createdAt: entry.at,
          details: parseDetails(entry)
        }))
      });
    }

    const audit = await new Promise((resolve, reject) => {
      tableAudit.listByEntity(_db, { entityType: 'signal', entityId: signal.id, limit: 200, offset: 0 }, (err, rows) => err ? reject(err) : resolve(rows || []));
    });

    tableAudit.create(
      _db,
      crypto.randomUUID(),
      'signal',
      signal.id,
      'status_view',
      `public:${req.ip || 'unknown'}`,
      Date.now(),
      JSON.stringify({ token, userAgent: req.headers['user-agent'] || null }),
      () => { }
    );

    return res.json({
      entityType: 'signal',
      signal,
      appeals: [],
      audit: audit.map(entry => ({
        id: entry.id,
        action: entry.action,
        actor: entry.actor,
        createdAt: entry.at,
        details: parseDetails(entry)
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

router.post('/status/:token/appeals', async (req, res) => {
  const token = String(req.params.token || '').trim();
  const _db = db(req);
  if (!_db || !token) return res.status(400).json({ error: 'invalid_token' });

  try {
    const notice = await toPromise(tableNotice.getByPublicToken, _db, token);
    if (!notice) return res.status(404).json({ error: 'not_found' });

    const decision = await toPromise(tableDecision.getByNoticeId, _db, notice.id);
    if (!decision) return res.status(409).json({ error: 'decision_pending' });

    const argsText = String(req.body?.arguments || '').trim();
    if (!argsText) return res.status(400).json({ error: 'arguments_required' });

    const filedBy = String(req.body?.contact || req.body?.filedBy || 'anonymous').trim() || 'anonymous';
    const now = Date.now();
    const id = crypto.randomUUID();

    await toPromise(tableAppeal.create, _db, id, decision.id, filedBy, now, argsText, null, null, null);

    tableAudit.create(
      _db,
      crypto.randomUUID(),
      'notice',
      notice.id,
      'appeal_create',
      `public:${req.ip || 'unknown'}`,
      now,
      JSON.stringify({ token, appealId: id, filedBy }),
      () => { }
    );

    void notifyContentOwner(req, {
      type: 'notice',
      event: 'notice_appeal_submitted',
      contentId: notice.contentId,
      category: notice.category,
      reasonText: notice.reasonText,
      reportedContentType: notice.reportedContentType,
      caseId: notice.id,
      statusUrl: buildStatusUrl(notice.publicToken),
      includeExcerpt: true,
      title: 'DSA appeal received',
      bodySegments: [
        `We received an appeal for DSA case #${notice.id}.`,
        `Filed by: ${filedBy || 'anonymous'}.`
      ]
    });
    void notifyReporter(req, {
      event: 'notice_appeal_submitted',
      notice: {
        id: notice.id,
        reporterEmail: notice.reporterEmail,
        reporterName: notice.reporterName,
        contentId: notice.contentId,
        category: notice.category,
        reasonText: notice.reasonText,
        publicToken: notice.publicToken,
        reportedContentType: notice.reportedContentType
      },
      statusUrl: buildStatusUrl(notice.publicToken),
      extras: { appealFiledBy: filedBy }
    });

    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

router.post('/status/:token/appeals/:appealId/evidence', (req, res) => {
  upload.single('file')(req, res, async (uploadErr) => {
    const token = String(req.params.token || '').trim();
    const appealId = String(req.params.appealId || '').trim();
    const _db = db(req);

    if (!_db || !token || !appealId) {
      return res.status(400).json({ error: 'invalid_request' });
    }

    if (uploadErr) {
      if (uploadErr.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'file_too_large' });
      return res.status(400).json({ error: 'upload_failed', detail: uploadErr.message });
    }

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'file_required' });

    try {
      const notice = await toPromise(tableNotice.getByPublicToken, _db, token);
      if (!notice) return res.status(404).json({ error: 'not_found' });

      const appeals = await new Promise((resolve, reject) => {
        tableAppeal.getById(_db, appealId, (err, row) => err ? reject(err) : resolve(row));
      });

      if (!appeals) return res.status(404).json({ error: 'appeal_not_found' });

      const id = crypto.randomUUID();
      const now = Date.now();

      tableEvidence.create(
        _db,
        id,
        notice.id,
        'file',
        null,
        null,
        file.originalname,
        file.filename,
        now,
        (err) => {
          if (err) return res.status(500).json({ error: 'db_error', detail: err.message });

          tableAudit.create(
            _db,
            crypto.randomUUID(),
            'notice',
            notice.id,
            'appeal_evidence',
            `public:${req.ip || 'unknown'}`,
            now,
            JSON.stringify({ token, appealId, evidenceId: id, fileName: file.originalname }),
            () => { }
          );

          res.status(201).json({ id });
        }
      );
    } catch (err) {
      res.status(500).json({ error: 'db_error', detail: err.message });
    }
  });
});

router.get('/status/:token/evidence/:id', async (req, res) => {
  const token = String(req.params.token || '').trim();
  const evidenceId = String(req.params.id || '').trim();
  const _db = db(req);
  if (!_db || !token || !evidenceId) return res.status(400).json({ error: 'invalid_request' });

  try {
    const notice = await toPromise(tableNotice.getByPublicToken, _db, token);
    if (!notice) return res.status(404).json({ error: 'not_found' });

    const evidence = await toPromise(tableEvidence.getById, _db, evidenceId);
    if (!evidence || evidence.noticeId !== notice.id || evidence.type !== 'file') {
      return res.status(404).json({ error: 'evidence_not_found' });
    }

    const safeName = evidence.filePath || evidence.fileName;
    if (!safeName) return res.status(404).json({ error: 'file_missing' });

    const fileOnDisk = path.join(evidenceUploadDir, path.basename(safeName));
    fs.access(fileOnDisk, fs.constants.R_OK, (err) => {
      if (err) return res.status(404).json({ error: 'file_missing' });
      res.download(fileOnDisk, evidence.fileName || path.basename(fileOnDisk), (downloadErr) => {
        if (downloadErr && !res.headersSent) {
          res.status(500).json({ error: 'download_failed' });
        }
      });
    });
  } catch (err) {
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

module.exports = router;
