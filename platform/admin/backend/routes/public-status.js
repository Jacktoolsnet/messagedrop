const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const tableNotice = require('../db/tableDsaNotice');
const tableSignal = require('../db/tableDsaSignal');
const tableDecision = require('../db/tableDsaDecision');
const tableEvidence = require('../db/tableDsaEvidence');
const tableAudit = require('../db/tableDsaAuditLog');

const evidenceUploadDir = path.join(__dirname, '..', 'uploads', 'evidence');

const router = express.Router();

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
