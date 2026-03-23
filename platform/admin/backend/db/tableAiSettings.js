const tableName = 'tableAiSettings';

function init(db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      selectedModel TEXT NOT NULL DEFAULT '',
      monthlyBudgetUsd REAL NOT NULL DEFAULT 0,
      updatedAt INTEGER NOT NULL DEFAULT 0
    );
  `;

  db.exec(sql, (err) => {
    if (err) {
      throw err;
    }
  });

  db.run(`
    INSERT INTO ${tableName} (id, selectedModel, monthlyBudgetUsd, updatedAt)
    VALUES (1, '', 0, 0)
    ON CONFLICT(id) DO NOTHING
  `, []);

  db.run(`
    ALTER TABLE ${tableName}
    ADD COLUMN monthlyBudgetUsd REAL NOT NULL DEFAULT 0
  `, [], (err) => {
    if (err && !String(err.message || '').includes('duplicate column name')) {
      throw err;
    }
  });
}

function get(db, callback = () => {}) {
  const sql = `
    SELECT id, selectedModel, monthlyBudgetUsd, updatedAt
    FROM ${tableName}
    WHERE id = 1
    LIMIT 1
  `;

  db.get(sql, [], (err, row) => {
    if (err) {
      callback(err);
      return;
    }
    callback(null, row || { id: 1, selectedModel: '', monthlyBudgetUsd: 0, updatedAt: 0 });
  });
}

function upsert(db, payload, callback = () => {}) {
  const now = Number.isFinite(payload?.updatedAt) ? Number(payload.updatedAt) : Date.now();
  const selectedModel = typeof payload?.selectedModel === 'string' ? payload.selectedModel : '';
  const monthlyBudgetUsd = Number.isFinite(Number(payload?.monthlyBudgetUsd))
    ? Math.max(0, Number(payload.monthlyBudgetUsd))
    : 0;
  const sql = `
    INSERT INTO ${tableName} (id, selectedModel, monthlyBudgetUsd, updatedAt)
    VALUES (1, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      selectedModel = excluded.selectedModel,
      monthlyBudgetUsd = excluded.monthlyBudgetUsd,
      updatedAt = excluded.updatedAt
  `;

  db.run(sql, [selectedModel, monthlyBudgetUsd, now], function (err) {
    if (err) {
      callback(err);
      return;
    }
    callback(null, {
      id: 1,
      selectedModel,
      monthlyBudgetUsd,
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
