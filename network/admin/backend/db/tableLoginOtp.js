// db/tableLoginOtp.js
const tableName = 'tableLoginOtp';

const columnId = 'id';
const columnUsername = 'username';
const columnCodeHash = 'codeHash';
const columnPayload = 'payload';
const columnExpiresAt = 'expiresAt';
const columnCreatedAt = 'createdAt';
const columnConsumedAt = 'consumedAt';

/**
 * Initialises the OTP login table.
 * Stores hashed codes only; payload keeps the minimal JWT payload for the login.
 */
const init = function (db) {
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        ${columnId} TEXT PRIMARY KEY NOT NULL,
        ${columnUsername} TEXT NOT NULL,
        ${columnCodeHash} TEXT NOT NULL,
        ${columnPayload} TEXT NOT NULL,
        ${columnExpiresAt} INTEGER NOT NULL,
        ${columnCreatedAt} INTEGER NOT NULL,
        ${columnConsumedAt} INTEGER DEFAULT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_${tableName}_username
        ON ${tableName}(${columnUsername});
      CREATE INDEX IF NOT EXISTS idx_${tableName}_expiresAt
        ON ${tableName}(${columnExpiresAt});
    `;
    db.exec(sql, (err) => {
      if (err) {
        throw err;
      }
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Creates a new OTP challenge.
 */
const create = function (db, id, username, codeHash, payload, expiresAt, createdAt, callback) {
  try {
    const sql = `
      INSERT INTO ${tableName} (
        ${columnId},
        ${columnUsername},
        ${columnCodeHash},
        ${columnPayload},
        ${columnExpiresAt},
        ${columnCreatedAt}
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;
    const params = [id, username, codeHash, payload, expiresAt, createdAt];
    db.run(sql, params, function (err) {
      callback(err);
    });
  } catch (error) {
    callback(error);
  }
};

/**
 * Returns a challenge by id (expired/consumed not filtered here).
 */
const getById = function (db, id, callback) {
  try {
    const sql = `SELECT * FROM ${tableName} WHERE ${columnId} = ? LIMIT 1`;
    db.get(sql, [id], (err, row) => {
      callback(err, row);
    });
  } catch (error) {
    callback(error);
  }
};

/**
 * Marks a challenge as used.
 */
const consume = function (db, id, callback) {
  try {
    const sql = `
      UPDATE ${tableName}
      SET ${columnConsumedAt} = ?
      WHERE ${columnId} = ?
    `;
    db.run(sql, [Date.now(), id], function (err) {
      callback(err, this.changes > 0);
    });
  } catch (error) {
    callback(error);
  }
};

/**
 * Cleans up expired or consumed rows.
 */
const cleanup = function (db, now, callback) {
  try {
    const sql = `
      DELETE FROM ${tableName}
      WHERE ${columnExpiresAt} < ?
         OR (${columnConsumedAt} IS NOT NULL AND ${columnConsumedAt} < ?)
    `;
    db.run(sql, [now, now - 24 * 60 * 60 * 1000], (err) => {
      callback(err);
    });
  } catch (error) {
    callback(error);
  }
};

/**
 * Removes pending challenges for a username.
 */
const deleteByUsername = function (db, username, callback) {
  try {
    const sql = `DELETE FROM ${tableName} WHERE ${columnUsername} = ?`;
    db.run(sql, [username], (err) => {
      callback(err);
    });
  } catch (error) {
    callback(error);
  }
};

module.exports = {
  init,
  create,
  getById,
  consume,
  cleanup,
  deleteByUsername
};
