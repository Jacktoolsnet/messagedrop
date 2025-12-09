// db/tableInfoLog.js
const tableName = 'tableInfoLog';
const columnId = 'id';
const columnSource = 'source';
const columnFile = 'file';
const columnMessage = 'message';
const columnCreatedAt = 'createdAt';

const init = function (db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      ${columnId} TEXT PRIMARY KEY NOT NULL,
      ${columnSource} TEXT NOT NULL,
      ${columnFile} TEXT NOT NULL,
      ${columnMessage} TEXT NOT NULL,
      ${columnCreatedAt} INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_${tableName}_createdAt ON ${tableName}(${columnCreatedAt});
  `;
  db.exec(sql, (err) => {
    if (err) throw err;
  });
};

const create = function (db, id, source, file, message, createdAt, callback) {
  const sql = `
    INSERT INTO ${tableName} (
      ${columnId},
      ${columnSource},
      ${columnFile},
      ${columnMessage},
      ${columnCreatedAt}
    ) VALUES (?, ?, ?, ?, ?)
  `;
  const params = [id, source, file, message, createdAt];
  db.run(sql, params, function (err) {
    callback(err);
  });
};

const cleanupOlderThan = function (db, threshold, callback) {
  const sql = `DELETE FROM ${tableName} WHERE ${columnCreatedAt} < ?`;
  db.run(sql, [threshold], (err) => callback(err));
};

module.exports = {
  tableName,
  init,
  create,
  cleanupOlderThan
};
