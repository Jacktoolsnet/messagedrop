const tableName = 'tableDsaAiAssessment';

const columns = {
  id: 'id',
  entityType: 'entityType',
  entityId: 'entityId',
  createdAt: 'createdAt',
  createdBy: 'createdBy',
  model: 'model',
  tosVersion: 'tosVersion',
  tosHash: 'tosHash',
  inputSnapshotJson: 'inputSnapshotJson',
  resultJson: 'resultJson'
};

function init(db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      ${columns.id} TEXT PRIMARY KEY NOT NULL,
      ${columns.entityType} TEXT NOT NULL,
      ${columns.entityId} TEXT NOT NULL,
      ${columns.createdAt} INTEGER NOT NULL,
      ${columns.createdBy} TEXT NOT NULL DEFAULT '',
      ${columns.model} TEXT NOT NULL DEFAULT '',
      ${columns.tosVersion} TEXT NOT NULL DEFAULT '',
      ${columns.tosHash} TEXT NOT NULL DEFAULT '',
      ${columns.inputSnapshotJson} TEXT NOT NULL DEFAULT '{}',
      ${columns.resultJson} TEXT NOT NULL DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_dsa_ai_assessment_entity_created
      ON ${tableName}(${columns.entityType}, ${columns.entityId}, ${columns.createdAt} DESC);

    CREATE INDEX IF NOT EXISTS idx_dsa_ai_assessment_created
      ON ${tableName}(${columns.createdAt} DESC);
  `;

  db.exec(sql, (err) => {
    if (err) {
      throw err;
    }
  });
}

function create(db, payload, callback = () => {}) {
  const sql = `
    INSERT INTO ${tableName} (
      ${columns.id},
      ${columns.entityType},
      ${columns.entityId},
      ${columns.createdAt},
      ${columns.createdBy},
      ${columns.model},
      ${columns.tosVersion},
      ${columns.tosHash},
      ${columns.inputSnapshotJson},
      ${columns.resultJson}
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(sql, [
    String(payload?.id || '').trim(),
    String(payload?.entityType || '').trim(),
    String(payload?.entityId || '').trim(),
    Number.isFinite(Number(payload?.createdAt)) ? Number(payload.createdAt) : Date.now(),
    typeof payload?.createdBy === 'string' ? payload.createdBy.trim().slice(0, 180) : '',
    typeof payload?.model === 'string' ? payload.model.trim().slice(0, 120) : '',
    typeof payload?.tosVersion === 'string' ? payload.tosVersion.trim().slice(0, 120) : '',
    typeof payload?.tosHash === 'string' ? payload.tosHash.trim().slice(0, 120) : '',
    typeof payload?.inputSnapshotJson === 'string' ? payload.inputSnapshotJson : '{}',
    typeof payload?.resultJson === 'string' ? payload.resultJson : '{}'
  ], function (err) {
    if (err) {
      callback(err);
      return;
    }
    callback(null, { id: payload?.id || null, changed: Number(this?.changes ?? 0) > 0 });
  });
}

function getLatestByEntity(db, entityType, entityId, callback = () => {}) {
  const sql = `
    SELECT *
    FROM ${tableName}
    WHERE ${columns.entityType} = ? AND ${columns.entityId} = ?
    ORDER BY ${columns.createdAt} DESC
    LIMIT 1
  `;

  db.get(sql, [entityType, entityId], (err, row) => {
    if (err) {
      callback(err);
      return;
    }
    callback(null, row || null);
  });
}

module.exports = {
  tableName,
  columns,
  init,
  create,
  getLatestByEntity
};
