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
const { apiError } = require('../middleware/api-error');
const { createPowGuard } = require('../middleware/pow');
const { logPowEvent } = require('../utils/powLogger');

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

function handlePowRequire(payload, req) {
  const db = req.database?.db;
  if (!db) return;
  void logPowEvent(db, { ...payload, source: 'admin-backend' }, req.logger).catch((err) => {
    req.logger?.warn?.('PoW log failed', { error: err?.message });
  });
}

const appealPow = createPowGuard({
  scope: 'public.status.appeal',
  threshold: 6,
  suspiciousThreshold: 3,
  onRequire: handlePowRequire
});

const evidencePow = createPowGuard({
  scope: 'public.status.appeal.evidence',
  threshold: 4,
  suspiciousThreshold: 2,
  difficulty: Number(process.env.POW_EVIDENCE_DIFFICULTY || process.env.POW_DIFFICULTY || 12),
  onRequire: handlePowRequire
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

router.get('/status/:token', async (req, res, next) => {
  const token = String(req.params.token || '').trim();
  const _db = db(req);
  if (!_db || !token) return next(apiError.badRequest('invalid_token'));

  try {
    let notice = await toPromise(tableNotice.getByPublicToken, _db, token);
    let signal = null;

    if (!notice) {
      signal = await toPromise(tableSignal.getByPublicToken, _db, token);
      if (!signal) {
        return next(apiError.notFound('not_found'));
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
    const apiErr = apiError.internal('db_error');
    apiErr.detail = err.message;
    return next(apiErr);
  }
});

router.post('/status/:token/appeals', appealPow, async (req, res, next) => {
  const token = String(req.params.token || '').trim();
  const _db = db(req);
  if (!_db || !token) return next(apiError.badRequest('invalid_token'));

  try {
    const notice = await toPromise(tableNotice.getByPublicToken, _db, token);
    if (!notice) return next(apiError.notFound('not_found'));

    const decision = await toPromise(tableDecision.getByNoticeId, _db, notice.id);
    if (!decision) return next(apiError.conflict('decision_pending'));

    const argsText = String(req.body?.arguments || '').trim();
    if (!argsText) return next(apiError.badRequest('arguments_required'));

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
    const apiErr = apiError.internal('db_error');
    apiErr.detail = err.message;
    return next(apiErr);
  }
});

router.post('/status/:token/appeals/:appealId/evidence', evidencePow, (req, res, next) => {
  upload.single('file')(req, res, async (uploadErr) => {
    const token = String(req.params.token || '').trim();
    const appealId = String(req.params.appealId || '').trim();
    const _db = db(req);

    if (!_db || !token || !appealId) {
      return next(apiError.badRequest('invalid_request'));
    }

    if (uploadErr) {
      if (uploadErr.code === 'LIMIT_FILE_SIZE') return next(apiError.badRequest('file_too_large'));
      const apiErr = apiError.badRequest('upload_failed');
      apiErr.detail = uploadErr.message;
      return next(apiErr);
    }

    const file = req.file;
    if (!file) return next(apiError.badRequest('file_required'));

    try {
      const notice = await toPromise(tableNotice.getByPublicToken, _db, token);
      if (!notice) return next(apiError.notFound('not_found'));

      const appeals = await new Promise((resolve, reject) => {
        tableAppeal.getById(_db, appealId, (err, row) => err ? reject(err) : resolve(row));
      });

      if (!appeals) return next(apiError.notFound('appeal_not_found'));

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
          if (err) {
            const apiErr = apiError.internal('db_error');
            apiErr.detail = err.message;
            return next(apiErr);
          }

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
      const apiErr = apiError.internal('db_error');
      apiErr.detail = err.message;
      return next(apiErr);
    }
  });
});

// Add general evidence to a notice via public token (no appeal association)
router.post('/status/:token/evidence', evidencePow, (req, res, next) => {
  upload.single('file')(req, res, async (uploadErr) => {
    const token = String(req.params.token || '').trim();
    const _db = db(req);

    if (!_db || !token) {
      return next(apiError.badRequest('invalid_request'));
    }

    if (uploadErr) {
      if (uploadErr.code === 'LIMIT_FILE_SIZE') return next(apiError.badRequest('file_too_large'));
      const apiErr = apiError.badRequest('upload_failed');
      apiErr.detail = uploadErr.message;
      return next(apiErr);
    }

    const hasFile = !!req.file;
    const type = hasFile ? 'file' : String(req.body?.type || 'url');
    const url = hasFile ? null : (req.body?.url ? String(req.body.url).trim() : null);
    const hash = req.body?.hash ? String(req.body.hash) : null;

    if (!hasFile) {
      if (type === 'url') {
        if (!url) return next(apiError.badRequest('url_required'));
        try {
          const parsed = new URL(url);
          if (!/^https?:$/i.test(parsed.protocol)) return next(apiError.badRequest('invalid_url_protocol'));
        } catch { return next(apiError.badRequest('invalid_url')); }
        if (url.length > 2000) return next(apiError.badRequest('url_too_long'));
      } else if (type === 'hash') {
        if (!hash) return next(apiError.badRequest('hash_required'));
      } else {
        return next(apiError.badRequest('unsupported_type'));
      }
    }

    try {
      const notice = await toPromise(tableNotice.getByPublicToken, _db, token);
      if (!notice) return next(apiError.notFound('not_found'));

      const id = crypto.randomUUID();
      const now = Date.now();
      const fileName = hasFile ? req.file.originalname : null;
      const storedName = hasFile ? req.file.filename : null;

      tableEvidence.create(
        _db,
        id,
        notice.id,
        type,
        hasFile ? null : url,
        hash,
        fileName,
        storedName,
        now,
        (err) => {
          if (err) {
            const apiErr = apiError.internal('db_error');
            apiErr.detail = err.message;
            return next(apiErr);
          }

          tableAudit.create(
            _db,
            crypto.randomUUID(),
            'notice',
            notice.id,
            'evidence_add',
            `public:${req.ip || 'unknown'}`,
            now,
            JSON.stringify({ token, evidenceId: id, type, url: url || undefined, fileName: fileName || undefined }),
            () => { }
          );

          res.status(201).json({ id });
        }
      );
    } catch (err) {
      const apiErr = apiError.internal('db_error');
      apiErr.detail = err.message;
      return next(apiErr);
    }
  });
});

// Add URL evidence via public token using a dedicated endpoint (no multipart)
router.post('/status/:token/evidence/url', async (req, res, next) => {
  const token = String(req.params.token || '').trim();
  const _db = db(req);
  if (!_db || !token) return next(apiError.badRequest('invalid_request'));

  const rawUrl = String(req.body?.url || '').trim();
  if (!rawUrl) return next(apiError.badRequest('url_required'));
  try {
    const parsed = new URL(rawUrl);
    if (!/^https?:$/i.test(parsed.protocol)) return next(apiError.badRequest('invalid_url_protocol'));
  } catch { return next(apiError.badRequest('invalid_url')); }
  if (rawUrl.length > 2000) return next(apiError.badRequest('url_too_long'));

  try {
    const notice = await toPromise(tableNotice.getByPublicToken, _db, token);
    if (!notice) return next(apiError.notFound('not_found'));

    const id = crypto.randomUUID();
    const now = Date.now();
    tableEvidence.create(
      _db,
      id,
      notice.id,
      'url',
      rawUrl,
      null,
      null,
      null,
      now,
      (err) => {
        if (err) {
          const apiErr = apiError.internal('db_error');
          apiErr.detail = err.message;
          return next(apiErr);
        }

        tableAudit.create(
          _db,
          crypto.randomUUID(),
          'notice',
          notice.id,
          'evidence_add',
          `public:${req.ip || 'unknown'}`,
          now,
          JSON.stringify({ token, evidenceId: id, type: 'url', url: rawUrl }),
          () => { }
        );

        res.status(201).json({ id });
      }
    );
  } catch (err) {
    const apiErr = apiError.internal('db_error');
    apiErr.detail = err.message;
    return next(apiErr);
  }
});

// Add URL evidence linked to an appeal (JSON body: { url: string })
router.post('/status/:token/appeals/:appealId/evidence/url', evidencePow, async (req, res, next) => {
  const token = String(req.params.token || '').trim();
  const appealId = String(req.params.appealId || '').trim();
  const _db = db(req);
  if (!_db || !token || !appealId) return next(apiError.badRequest('invalid_request'));

  const rawUrl = String(req.body?.url || '').trim();
  if (!rawUrl) return next(apiError.badRequest('url_required'));

  // Basic validation: must be http(s) URL
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return next(apiError.badRequest('invalid_url'));
  }
  if (!/^https?:$/i.test(parsed.protocol)) return next(apiError.badRequest('invalid_url_protocol'));
  if (rawUrl.length > 2000) return next(apiError.badRequest('url_too_long'));

  try {
    const notice = await toPromise(tableNotice.getByPublicToken, _db, token);
    if (!notice) return next(apiError.notFound('not_found'));

    const appeal = await new Promise((resolve, reject) => {
      tableAppeal.getById(_db, appealId, (err, row) => err ? reject(err) : resolve(row));
    });
    if (!appeal) return next(apiError.notFound('appeal_not_found'));

    const id = crypto.randomUUID();
    const now = Date.now();
    tableEvidence.create(
      _db,
      id,
      notice.id,
      'url',
      rawUrl,
      null,
      null,
      null,
      now,
      (err) => {
        if (err) {
          const apiErr = apiError.internal('db_error');
          apiErr.detail = err.message;
          return next(apiErr);
        }

        tableAudit.create(
          _db,
          crypto.randomUUID(),
          'notice',
          notice.id,
          'appeal_evidence',
          `public:${req.ip || 'unknown'}`,
          now,
          JSON.stringify({ token, appealId, evidenceId: id, url: rawUrl }),
          () => { }
        );

        return res.status(201).json({ id });
      }
    );
  } catch (err) {
    const apiErr = apiError.internal('db_error');
    apiErr.detail = err.message;
    return next(apiErr);
  }
});

router.get('/status/:token/evidence/:id', async (req, res, next) => {
  const token = String(req.params.token || '').trim();
  const evidenceId = String(req.params.id || '').trim();
  const _db = db(req);
  if (!_db || !token || !evidenceId) return next(apiError.badRequest('invalid_request'));

  try {
    const notice = await toPromise(tableNotice.getByPublicToken, _db, token);
    if (!notice) return next(apiError.notFound('not_found'));

    const evidence = await toPromise(tableEvidence.getById, _db, evidenceId);
    if (!evidence || evidence.noticeId !== notice.id || evidence.type !== 'file') {
      return next(apiError.notFound('evidence_not_found'));
    }

    const safeName = evidence.filePath || evidence.fileName;
    if (!safeName) return next(apiError.notFound('file_missing'));

    const fileOnDisk = path.join(evidenceUploadDir, path.basename(safeName));
    fs.access(fileOnDisk, fs.constants.R_OK, (err) => {
      if (err) return next(apiError.notFound('file_missing'));
      res.download(fileOnDisk, evidence.fileName || path.basename(fileOnDisk), (downloadErr) => {
        if (downloadErr && !res.headersSent) {
          return next(apiError.internal('download_failed'));
        }
      });
    });
  } catch (err) {
    const apiErr = apiError.internal('db_error');
    apiErr.detail = err.message;
    return next(apiErr);
  }
});

module.exports = router;
