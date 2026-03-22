const tableName = 'tableAiSettings';

function init(db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      selectedModel TEXT NOT NULL DEFAULT '',
      updatedAt INTEGER NOT NULL DEFAULT 0
    );
  `;

  db.exec(sql, (err) => {
    if (err) {
      throw err;
    }
  });

  db.run(`
    INSERT INTO ${tableName} (id, selectedModel, updatedAt)
    VALUES (1, '', 0)
    ON CONFLICT(id) DO NOTHING
  `, []);
}

function get(db, callback = () => {}) {
  const sql = `
    SELECT id, selectedModel, updatedAt
    FROM ${tableName}
    WHERE id = 1
    LIMIT 1
  `;

  db.get(sql, [], (err, row) => {
    if (err) {
      callback(err);
      return;
    }
    callback(null, row || { id: 1, selectedModel: '', updatedAt: 0 });
  });
}

function upsert(db, payload, callback = () => {}) {
  const now = Number.isFinite(payload?.updatedAt) ? Number(payload.updatedAt) : Date.now();
  const selectedModel = typeof payload?.selectedModel === 'string' ? payload.selectedModel : '';
  const sql = `
    INSERT INTO ${tableName} (id, selectedModel, updatedAt)
    VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      selectedModel = excluded.selectedModel,
      updatedAt = excluded.updatedAt
  `;

  db.run(sql, [selectedModel, now], function (err) {
    if (err) {
      callback(err);
      return;
    }
    callback(null, {
      id: 1,
      selectedModel,
      updatedAt: now,
      changed: Number(this?.changes ?? 0) > 0
    });
  });
}

module.exports = {
  tableName,
  init,
  get,
  upsert
};
