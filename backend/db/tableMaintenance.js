const tableName = 'tableMaintenance';

const columnId = 'id';
const columnEnabled = 'enabled';
const columnStartsAt = 'startsAt';
const columnEndsAt = 'endsAt';
const columnReason = 'reason';
const columnReasonEn = 'reasonEn';
const columnReasonEs = 'reasonEs';
const columnReasonFr = 'reasonFr';
const columnUpdatedAt = 'updatedAt';

const init = function (db) {
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        ${columnId} INTEGER PRIMARY KEY NOT NULL CHECK (${columnId} = 1),
        ${columnEnabled} INTEGER NOT NULL DEFAULT 0,
        ${columnStartsAt} INTEGER DEFAULT NULL,
        ${columnEndsAt} INTEGER DEFAULT NULL,
        ${columnReason} TEXT DEFAULT NULL,
        ${columnReasonEn} TEXT DEFAULT NULL,
        ${columnReasonEs} TEXT DEFAULT NULL,
        ${columnReasonFr} TEXT DEFAULT NULL,
        ${columnUpdatedAt} INTEGER NOT NULL
      );`;

    db.run(sql, (err) => {
      if (err) {
        throw err;
      }
    });

    db.run(
      `INSERT OR IGNORE INTO ${tableName} (${columnId}, ${columnEnabled}, ${columnUpdatedAt}) VALUES (1, 0, strftime('%s','now'));`
    );
  } catch (error) {
    throw error;
  }
};

const get = function (db, callback) {
  try {
    db.get(`SELECT * FROM ${tableName} WHERE ${columnId} = 1;`, (err, row) => {
      callback(err, row);
    });
  } catch (error) {
    callback(error);
  }
};

const set = function (
  db,
  { enabled, startsAt, endsAt, reason, reasonEn, reasonEs, reasonFr },
  callback
) {
  try {
    const sql = `
      UPDATE ${tableName}
      SET ${columnEnabled} = ?,
          ${columnStartsAt} = ?,
          ${columnEndsAt} = ?,
          ${columnReason} = ?,
          ${columnReasonEn} = ?,
          ${columnReasonEs} = ?,
          ${columnReasonFr} = ?,
          ${columnUpdatedAt} = strftime('%s','now')
      WHERE ${columnId} = 1;`;

    db.run(
      sql,
      [enabled, startsAt, endsAt, reason, reasonEn, reasonEs, reasonFr],
      (err) => callback(err)
    );
  } catch (error) {
    callback(error);
  }
};

module.exports = {
  init,
  get,
  set
};
