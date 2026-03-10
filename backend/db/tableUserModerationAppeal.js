const tableName = 'tableUserModerationAppeal';

const appealTarget = {
  POSTING: 'posting',
  ACCOUNT: 'account'
};

const appealStatus = {
  OPEN: 'open',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected'
};

const columnId = 'id';
const columnUserId = 'userId';
const columnTarget = 'target';
const columnStatus = 'status';
const columnMessage = 'message';
const columnCreatedAt = 'createdAt';
const columnResolvedAt = 'resolvedAt';
const columnResolutionMessage = 'resolutionMessage';
const columnReviewer = 'reviewer';

function mapRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row[columnId],
    userId: row[columnUserId],
    target: row[columnTarget],
    status: row[columnStatus],
    message: row[columnMessage],
    createdAt: row[columnCreatedAt],
    resolvedAt: row[columnResolvedAt],
    resolutionMessage: row[columnResolutionMessage],
    reviewer: row[columnReviewer]
  };
}

function init(db) {
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        ${columnId} TEXT PRIMARY KEY NOT NULL,
        ${columnUserId} TEXT NOT NULL,
        ${columnTarget} TEXT NOT NULL,
        ${columnStatus} TEXT NOT NULL DEFAULT '${appealStatus.OPEN}',
        ${columnMessage} TEXT NOT NULL,
        ${columnCreatedAt} INTEGER NOT NULL,
        ${columnResolvedAt} INTEGER DEFAULT NULL,
        ${columnResolutionMessage} TEXT DEFAULT NULL,
        ${columnReviewer} TEXT DEFAULT NULL,
        CONSTRAINT FK_USER_MODERATION_APPEAL_USER FOREIGN KEY (${columnUserId})
          REFERENCES tableUser (id)
          ON UPDATE CASCADE
          ON DELETE CASCADE
      );
    `;

    db.run(sql, (err) => {
      if (err) {
        throw err;
      }
    });

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_user_moderation_appeal_user
      ON ${tableName}(${columnUserId}, ${columnCreatedAt} DESC);
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_user_moderation_appeal_open
      ON ${tableName}(${columnUserId}, ${columnTarget}, ${columnStatus});
    `);
  } catch (error) {
    throw error;
  }
}

function create(db, appeal, callback) {
  try {
    const sql = `
      INSERT INTO ${tableName} (
        ${columnId},
        ${columnUserId},
        ${columnTarget},
        ${columnStatus},
        ${columnMessage},
        ${columnCreatedAt},
        ${columnResolvedAt},
        ${columnResolutionMessage},
        ${columnReviewer}
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    db.run(sql, [
      appeal.id,
      appeal.userId,
      appeal.target,
      appeal.status || appealStatus.OPEN,
      appeal.message,
      appeal.createdAt,
      appeal.resolvedAt || null,
      appeal.resolutionMessage || null,
      appeal.reviewer || null
    ], function (err) {
      if (err) {
        return callback(err);
      }
      getById(db, appeal.id, callback);
    });
  } catch (error) {
    callback(error);
  }
}

function getById(db, id, callback) {
  try {
    const sql = `
      SELECT *
      FROM ${tableName}
      WHERE ${columnId} = ?;
    `;

    db.get(sql, [id], (err, row) => {
      callback(err, mapRow(row));
    });
  } catch (error) {
    callback(error);
  }
}

function listByUserId(db, userId, callback) {
  try {
    const sql = `
      SELECT *
      FROM ${tableName}
      WHERE ${columnUserId} = ?
      ORDER BY ${columnCreatedAt} DESC;
    `;

    db.all(sql, [userId], (err, rows) => {
      if (err) {
        return callback(err);
      }
      callback(null, (rows || []).map(mapRow));
    });
  } catch (error) {
    callback(error);
  }
}

function listOpenByUserIdAndTarget(db, userId, target, callback) {
  try {
    const sql = `
      SELECT *
      FROM ${tableName}
      WHERE ${columnUserId} = ?
        AND ${columnTarget} = ?
        AND ${columnStatus} = '${appealStatus.OPEN}'
      ORDER BY ${columnCreatedAt} DESC;
    `;

    db.all(sql, [userId, target], (err, rows) => {
      if (err) {
        return callback(err);
      }
      callback(null, (rows || []).map(mapRow));
    });
  } catch (error) {
    callback(error);
  }
}

function listOpen(db, limit, callback) {
  try {
    const normalizedLimit = Number.isFinite(Number(limit)) && Number(limit) > 0
      ? Math.min(Math.floor(Number(limit)), 500)
      : 100;
    const sql = `
      SELECT *
      FROM ${tableName}
      WHERE ${columnStatus} = '${appealStatus.OPEN}'
      ORDER BY ${columnCreatedAt} DESC
      LIMIT ?;
    `;

    db.all(sql, [normalizedLimit], (err, rows) => {
      if (err) {
        return callback(err);
      }
      callback(null, (rows || []).map(mapRow));
    });
  } catch (error) {
    callback(error);
  }
}

function countOpen(db, callback) {
  try {
    const sql = `
      SELECT COUNT(*) AS total
      FROM ${tableName}
      WHERE ${columnStatus} = '${appealStatus.OPEN}';
    `;

    db.get(sql, [], (err, row) => {
      if (err) {
        return callback(err);
      }
      callback(null, Number(row?.total || 0));
    });
  } catch (error) {
    callback(error);
  }
}

function updateResolution(db, id, status, resolvedAt, resolutionMessage, reviewer, callback) {
  try {
    const sql = `
      UPDATE ${tableName}
      SET ${columnStatus} = ?,
          ${columnResolvedAt} = ?,
          ${columnResolutionMessage} = ?,
          ${columnReviewer} = ?
      WHERE ${columnId} = ?;
    `;

    db.run(sql, [status, resolvedAt, resolutionMessage || null, reviewer || null, id], function (err) {
      if (err) {
        return callback(err);
      }
      if (!(this?.changes > 0)) {
        return callback(null, null);
      }
      getById(db, id, callback);
    });
  } catch (error) {
    callback(error);
  }
}

module.exports = {
  tableName,
  appealTarget,
  appealStatus,
  init,
  create,
  getById,
  listByUserId,
  listOpenByUserIdAndTarget,
  listOpen,
  countOpen,
  updateResolution,
  columns: {
    id: columnId,
    userId: columnUserId,
    target: columnTarget,
    status: columnStatus,
    message: columnMessage,
    createdAt: columnCreatedAt,
    resolvedAt: columnResolvedAt,
    resolutionMessage: columnResolutionMessage,
    reviewer: columnReviewer
  }
};
