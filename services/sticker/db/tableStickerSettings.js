const tableName = 'tableStickerSettings';

const columns = {
  id: 'id',
  notFoundStickerId: 'notFoundStickerId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

function init(db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      ${columns.id} INTEGER PRIMARY KEY NOT NULL CHECK (${columns.id} = 1),
      ${columns.notFoundStickerId} TEXT DEFAULT NULL,
      ${columns.createdAt} INTEGER NOT NULL,
      ${columns.updatedAt} INTEGER NOT NULL
    );
  `;

  db.exec(sql, (err) => {
    if (err) {
      throw err;
    }
  });

  const now = Date.now();
  db.run(`
    INSERT OR IGNORE INTO ${tableName} (${columns.id}, ${columns.notFoundStickerId}, ${columns.createdAt}, ${columns.updatedAt})
    VALUES (1, NULL, ?, ?)
  `, [now, now], () => { /* ignore */ });
}

function get(db, callback) {
  db.get(`SELECT * FROM ${tableName} WHERE ${columns.id} = 1 LIMIT 1`, [], (err, row) => {
    callback(err, row || null);
  });
}

function update(db, fields, callback) {
  const updates = [];
  const params = [];
  const allowedKeys = [columns.notFoundStickerId];

  for (const key of allowedKeys) {
    if (!Object.prototype.hasOwnProperty.call(fields || {}, key)) {
      continue;
    }
    updates.push(`${key} = ?`);
    params.push(fields[key]);
  }

  if (updates.length === 0) {
    return process.nextTick(() => callback(null, false));
  }

  updates.push(`${columns.updatedAt} = ?`);
  params.push(Number.isFinite(fields?.updatedAt) ? fields.updatedAt : Date.now());
  params.push(1);

  db.run(`UPDATE ${tableName} SET ${updates.join(', ')} WHERE ${columns.id} = ?`, params, function onUpdate(err) {
    if (err) {
      return callback(err);
    }
    return callback(null, this?.changes > 0);
  });
}

module.exports = {
  tableName,
  columns,
  init,
  get,
  update
};
