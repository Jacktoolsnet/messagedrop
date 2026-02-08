const tableName = 'tableUsageProtection';
const columnUserId = 'userId';
const columnSettings = 'settings';
const columnState = 'state';
const columnUpdatedAt = 'updatedAt';

const init = function (db) {
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        ${columnUserId} TEXT PRIMARY KEY NOT NULL,
        ${columnSettings} TEXT NOT NULL,
        ${columnState} TEXT NOT NULL,
        ${columnUpdatedAt} INTEGER NOT NULL DEFAULT (strftime('%s','now')),
        CONSTRAINT FK_USAGE_PROTECTION_USER_ID FOREIGN KEY (${columnUserId})
          REFERENCES tableUser (id)
          ON UPDATE CASCADE ON DELETE CASCADE
      );`;

    db.run(sql, (err) => {
      if (err) {
        throw err;
      }
    });
  } catch (error) {
    throw error;
  }
};

const getByUserId = function (db, userId, callback) {
  try {
    const sql = `
      SELECT ${columnUserId}, ${columnSettings}, ${columnState}, ${columnUpdatedAt}
      FROM ${tableName}
      WHERE ${columnUserId} = ?;`;
    db.get(sql, [userId], (err, row) => {
      callback(err, row);
    });
  } catch (error) {
    callback(error);
  }
};

const upsert = function (db, userId, settings, state, callback) {
  try {
    const sql = `
      INSERT INTO ${tableName} (
        ${columnUserId},
        ${columnSettings},
        ${columnState},
        ${columnUpdatedAt}
      ) VALUES (?, ?, ?, strftime('%s','now'))
      ON CONFLICT(${columnUserId}) DO UPDATE SET
        ${columnSettings} = excluded.${columnSettings},
        ${columnState} = excluded.${columnState},
        ${columnUpdatedAt} = strftime('%s','now');`;

    db.run(sql, [userId, settings, state], (err) => {
      callback(err);
    });
  } catch (error) {
    callback(error);
  }
};

module.exports = {
  init,
  getByUserId,
  upsert
};
