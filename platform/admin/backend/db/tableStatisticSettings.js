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
  const validItems = items.filter((it) => it && typeof it.metricKey === 'string' && it.metricKey.trim() !== '');
  if (!validItems.length) {
    callback(null);
    return;
  }

  const sql = `
    INSERT INTO ${tableName} (metricKey, displayName, iconName, color, sortOrder)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(metricKey) DO UPDATE SET
      displayName = excluded.displayName,
      iconName = excluded.iconName,
      color = excluded.color,
      sortOrder = excluded.sortOrder;
  `;

  let index = 0;
  const runNext = () => {
    if (index >= validItems.length) {
      callback(null);
      return;
    }
    const it = validItems[index++];
    const params = [
      it.metricKey,
      it.displayName ?? null,
      it.iconName ?? null,
      it.color ?? null,
      Number.isFinite(it.sortOrder) ? Number(it.sortOrder) : null
    ];
    db.run(sql, params, (err) => {
      if (err) {
        callback(err);
        return;
      }
      runNext();
    });
  };

  runNext();
}

module.exports = { init, getAll, upsertMany };
