const path = require('path');
const fs = require('fs');
const tableSignal = require('../db/tableDsaSignal');
const tableNotice = require('../db/tableDsaNotice');
const tableEvidence = require('../db/tableDsaEvidence');
const tableDecision = require('../db/tableDsaDecision');
const tableAppeal = require('../db/tableDsaAppeal');
const tableNotification = require('../db/tableDsaNotification');
const tableAudit = require('../db/tableDsaAuditLog');

const evidenceUploadDir = path.join(__dirname, '..', 'uploads', 'evidence');

function subtractMonths(timestamp, months) {
  const date = new Date(timestamp);
  date.setMonth(date.getMonth() - months);
  return date.getTime();
}

function uniqueStrings(values) {
  return [...new Set(
    (values || [])
      .filter((value) => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean)
  )];
}

function buildInClause(count) {
  return new Array(count).fill('?').join(',');
}

function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this.changes || 0);
    });
  });
}

function resolveEvidencePath(filePath) {
  if (!filePath) return null;
  const resolved = path.resolve(evidenceUploadDir, filePath);
  const base = evidenceUploadDir.endsWith(path.sep)
    ? evidenceUploadDir
    : `${evidenceUploadDir}${path.sep}`;
  if (!resolved.startsWith(base)) {
    return null;
  }
  return resolved;
}

async function deleteEvidenceFiles(rows, logger) {
  let removed = 0;
  for (const row of rows || []) {
    const resolved = resolveEvidencePath(row.filePath);
    if (!resolved) continue;
    try {
      await fs.promises.unlink(resolved);
      removed += 1;
    } catch (err) {
      if (err?.code !== 'ENOENT') {
        logger?.warn?.('DSA evidence file delete failed', {
          filePath: row.filePath,
          error: err?.message || err
        });
      }
    }
  }
  return removed;
}

async function cleanupClosedDsaCases(db, logger, options = {}) {
  const log = logger ?? console;
  if (!db) {
    log?.warn?.('DSA cleanup skipped: database unavailable');
    return {
      notices: 0,
      signals: 0,
      decisions: 0,
      appeals: 0,
      evidence: 0,
      evidenceFiles: 0,
      notifications: 0,
      auditLogs: 0
    };
  }

  const retentionMonths = Number.isFinite(options.retentionMonths)
    ? options.retentionMonths
    : 6;
  const threshold = subtractMonths(Date.now(), retentionMonths);
  const legalHoldOutcome = options.legalHoldOutcome || 'FORWARD_TO_AUTHORITY';

  const noticeRows = await dbAll(
    db,
    `
      SELECT n.${tableNotice.columns.id} AS id,
             COALESCE(MAX(d.${tableDecision.columns.decidedAt}), n.${tableNotice.columns.updatedAt}) AS closedAt
        FROM ${tableNotice.tableName} n
        LEFT JOIN ${tableDecision.tableName} d
               ON d.${tableDecision.columns.noticeId} = n.${tableNotice.columns.id}
       WHERE n.${tableNotice.columns.status} = 'DECIDED'
         AND NOT EXISTS (
           SELECT 1
             FROM ${tableDecision.tableName} d_hold
            WHERE d_hold.${tableDecision.columns.noticeId} = n.${tableNotice.columns.id}
              AND d_hold.${tableDecision.columns.outcome} = ?
         )
       GROUP BY n.${tableNotice.columns.id}
      HAVING closedAt <= ?
    `,
    [legalHoldOutcome, threshold]
  );
  const noticeIds = uniqueStrings(noticeRows.map((row) => row.id));

  const decisionIds = noticeIds.length
    ? uniqueStrings((await dbAll(
      db,
      `SELECT ${tableDecision.columns.id} AS id FROM ${tableDecision.tableName} WHERE ${tableDecision.columns.noticeId} IN (${buildInClause(noticeIds.length)})`,
      noticeIds
    )).map((row) => row.id))
    : [];

  const appealIds = decisionIds.length
    ? uniqueStrings((await dbAll(
      db,
      `SELECT ${tableAppeal.columns.id} AS id FROM ${tableAppeal.tableName} WHERE ${tableAppeal.columns.decisionId} IN (${buildInClause(decisionIds.length)})`,
      decisionIds
    )).map((row) => row.id))
    : [];

  const evidenceRows = noticeIds.length
    ? await dbAll(
      db,
      `SELECT ${tableEvidence.columns.id} AS id, ${tableEvidence.columns.noticeId} AS noticeId, ${tableEvidence.columns.filePath} AS filePath FROM ${tableEvidence.tableName} WHERE ${tableEvidence.columns.noticeId} IN (${buildInClause(noticeIds.length)})`,
      noticeIds
    )
    : [];

  const evidenceFilesRemoved = await deleteEvidenceFiles(evidenceRows, log);

  let notificationsDeleted = 0;
  if (noticeIds.length) {
    notificationsDeleted += await dbRun(
      db,
      `DELETE FROM ${tableNotification.tableName} WHERE ${tableNotification.columns.noticeId} IN (${buildInClause(noticeIds.length)})`,
      noticeIds
    );
  }
  if (decisionIds.length) {
    notificationsDeleted += await dbRun(
      db,
      `DELETE FROM ${tableNotification.tableName} WHERE ${tableNotification.columns.decisionId} IN (${buildInClause(decisionIds.length)})`,
      decisionIds
    );
  }

  let auditLogsDeleted = 0;
  if (noticeIds.length) {
    auditLogsDeleted += await dbRun(
      db,
      `DELETE FROM ${tableAudit.tableName} WHERE ${tableAudit.columns.entityType} = ? AND ${tableAudit.columns.entityId} IN (${buildInClause(noticeIds.length)})`,
      ['notice', ...noticeIds]
    );
  }
  if (decisionIds.length) {
    auditLogsDeleted += await dbRun(
      db,
      `DELETE FROM ${tableAudit.tableName} WHERE ${tableAudit.columns.entityType} = ? AND ${tableAudit.columns.entityId} IN (${buildInClause(decisionIds.length)})`,
      ['decision', ...decisionIds]
    );
  }
  if (appealIds.length) {
    auditLogsDeleted += await dbRun(
      db,
      `DELETE FROM ${tableAudit.tableName} WHERE ${tableAudit.columns.entityType} = ? AND ${tableAudit.columns.entityId} IN (${buildInClause(appealIds.length)})`,
      ['appeal', ...appealIds]
    );
  }

  if (appealIds.length) {
    await dbRun(
      db,
      `DELETE FROM ${tableAppeal.tableName} WHERE ${tableAppeal.columns.id} IN (${buildInClause(appealIds.length)})`,
      appealIds
    );
  }

  if (decisionIds.length) {
    await dbRun(
      db,
      `DELETE FROM ${tableDecision.tableName} WHERE ${tableDecision.columns.id} IN (${buildInClause(decisionIds.length)})`,
      decisionIds
    );
  }

  if (evidenceRows.length) {
    await dbRun(
      db,
      `DELETE FROM ${tableEvidence.tableName} WHERE ${tableEvidence.columns.id} IN (${buildInClause(evidenceRows.length)})`,
      evidenceRows.map((row) => row.id)
    );
  }

  if (noticeIds.length) {
    await dbRun(
      db,
      `DELETE FROM ${tableNotice.tableName} WHERE ${tableNotice.columns.id} IN (${buildInClause(noticeIds.length)})`,
      noticeIds
    );
  }

  const signalRows = await dbAll(
    db,
    `SELECT ${tableSignal.columns.id} AS id FROM ${tableSignal.tableName} WHERE ${tableSignal.columns.dismissedAt} IS NOT NULL AND ${tableSignal.columns.dismissedAt} <= ?`,
    [threshold]
  );
  const signalIds = uniqueStrings(signalRows.map((row) => row.id));

  if (signalIds.length) {
    auditLogsDeleted += await dbRun(
      db,
      `DELETE FROM ${tableAudit.tableName} WHERE ${tableAudit.columns.entityType} = ? AND ${tableAudit.columns.entityId} IN (${buildInClause(signalIds.length)})`,
      ['signal', ...signalIds]
    );
    await dbRun(
      db,
      `DELETE FROM ${tableSignal.tableName} WHERE ${tableSignal.columns.id} IN (${buildInClause(signalIds.length)})`,
      signalIds
    );
  }

  const result = {
    notices: noticeIds.length,
    signals: signalIds.length,
    decisions: decisionIds.length,
    appeals: appealIds.length,
    evidence: evidenceRows.length,
    evidenceFiles: evidenceFilesRemoved,
    notifications: notificationsDeleted,
    auditLogs: auditLogsDeleted
  };

  log?.info?.('DSA cleanup completed', result);
  return result;
}

module.exports = {
  cleanupClosedDsaCases
};
