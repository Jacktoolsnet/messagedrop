const tableName = 'tableStatisticSettings';

const init = function (db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      metricKey TEXT PRIMARY KEY,
      displayName TEXT,
      iconName TEXT,
      color TEXT,
      sortOrder INTEGER
    );
  `;
  db.exec(sql, (err) => { if (err) throw err; });
};

function getAll(db, callback = () => { }) {
  const sql = `SELECT metricKey, displayName, iconName, color, sortOrder FROM ${tableName} ORDER BY COALESCE(sortOrder, 2147483647), metricKey ASC;`;
  db.all(sql, [], (err, rows) => callback(err || null, rows || []));
}

function upsertMany(db, items, callback = () => { }) {
  if (!Array.isArray(items)) return callback(new Error('items must be an array'));
  db.serialize(() => {
    const stmt = db.prepare(`
      INSERT INTO ${tableName} (metricKey, displayName, iconName, color, sortOrder)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(metricKey) DO UPDATE SET
        displayName = excluded.displayName,
        iconName = excluded.iconName,
        color = excluded.color,
        sortOrder = excluded.sortOrder;
    `);
    for (const it of items) {
      if (!it || typeof it.metricKey !== 'string' || it.metricKey.trim() === '') continue;
      stmt.run([
        it.metricKey,
        it.displayName ?? null,
        it.iconName ?? null,
        it.color ?? null,
        Number.isFinite(it.sortOrder) ? Number(it.sortOrder) : null
      ]);
    }
    stmt.finalize((err) => callback(err || null));
  });
}

module.exports = { init, getAll, upsertMany };

