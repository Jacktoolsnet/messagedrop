const tableName = 'tableContactProfileExchange';

const columnId = 'id';
const columnRequesterUserId = 'requesterUserId';
const columnRequesterContactId = 'requesterContactId';
const columnRecipientUserId = 'recipientUserId';
const columnRequesterHint = 'requesterHint';
const columnRequesterEncryptionPublicKey = 'requesterEncryptionPublicKey';
const columnStatus = 'status';
const columnEncryptedProfilePayload = 'encryptedProfilePayload';
const columnResponseSignature = 'responseSignature';
const columnCreatedAt = 'createdAt';
const columnDecidedAt = 'decidedAt';
const columnExpiresAt = 'expiresAt';

const exchangeStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  DECLINED: 'declined'
};

const activeStatuses = [
  exchangeStatus.PENDING,
  exchangeStatus.APPROVED,
  exchangeStatus.DECLINED
];

const init = function (db) {
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        ${columnId} TEXT PRIMARY KEY NOT NULL,
        ${columnRequesterUserId} TEXT NOT NULL,
        ${columnRequesterContactId} TEXT NOT NULL,
        ${columnRecipientUserId} TEXT NOT NULL,
        ${columnRequesterHint} TEXT DEFAULT NULL,
        ${columnRequesterEncryptionPublicKey} TEXT NOT NULL,
        ${columnStatus} TEXT NOT NULL DEFAULT '${exchangeStatus.PENDING}' CHECK (${columnStatus} IN ('${exchangeStatus.PENDING}','${exchangeStatus.APPROVED}','${exchangeStatus.DECLINED}')),
        ${columnEncryptedProfilePayload} TEXT DEFAULT NULL,
        ${columnResponseSignature} TEXT DEFAULT NULL,
        ${columnCreatedAt} INTEGER NOT NULL DEFAULT (strftime('%s','now')),
        ${columnDecidedAt} INTEGER DEFAULT NULL,
        ${columnExpiresAt} INTEGER NOT NULL,
        CONSTRAINT FK_PROFILE_EXCHANGE_REQUESTER_USER FOREIGN KEY (${columnRequesterUserId})
          REFERENCES tableUser (id)
          ON UPDATE CASCADE ON DELETE CASCADE,
        CONSTRAINT FK_PROFILE_EXCHANGE_REQUESTER_CONTACT FOREIGN KEY (${columnRequesterContactId})
          REFERENCES tableContact (id)
          ON UPDATE CASCADE ON DELETE CASCADE,
        CONSTRAINT FK_PROFILE_EXCHANGE_RECIPIENT_USER FOREIGN KEY (${columnRecipientUserId})
          REFERENCES tableUser (id)
          ON UPDATE CASCADE ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_profile_exchange_recipient_pending
        ON ${tableName} (${columnRecipientUserId}, ${columnStatus}, ${columnCreatedAt});

      CREATE INDEX IF NOT EXISTS idx_profile_exchange_requester_resolved
        ON ${tableName} (${columnRequesterUserId}, ${columnStatus}, ${columnDecidedAt});

      CREATE INDEX IF NOT EXISTS idx_profile_exchange_expires_at
        ON ${tableName} (${columnExpiresAt});

      CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_exchange_active_request
        ON ${tableName} (${columnRequesterContactId}, ${columnRecipientUserId})
        WHERE ${columnStatus} IN ('${activeStatuses.join(`','`)}');
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

const createPending = function (db, exchange, callback) {
  try {
    const sql = `
      INSERT INTO ${tableName} (
        ${columnId},
        ${columnRequesterUserId},
        ${columnRequesterContactId},
        ${columnRecipientUserId},
        ${columnRequesterHint},
        ${columnRequesterEncryptionPublicKey},
        ${columnStatus},
        ${columnExpiresAt}
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `;

    const params = [
      exchange.id,
      exchange.requesterUserId,
      exchange.requesterContactId,
      exchange.recipientUserId,
      exchange.requesterHint ?? null,
      exchange.requesterEncryptionPublicKey,
      exchange.status ?? exchangeStatus.PENDING,
      exchange.expiresAt
    ];

    db.run(sql, params, function (err) {
      callback(err, this?.changes ?? 0);
    });
  } catch (error) {
    callback(error);
  }
};

const getById = function (db, exchangeId, callback) {
  try {
    const sql = `
      SELECT *
      FROM ${tableName}
      WHERE ${columnId} = ?;
    `;
    db.get(sql, [exchangeId], (err, row) => callback(err, row));
  } catch (error) {
    callback(error);
  }
};

const getActiveByRequesterContact = function (db, requesterContactId, recipientUserId, callback) {
  try {
    const sql = `
      SELECT *
      FROM ${tableName}
      WHERE ${columnRequesterContactId} = ?
        AND ${columnRecipientUserId} = ?
        AND ${columnStatus} IN ('${activeStatuses.join(`','`)}')
      ORDER BY ${columnCreatedAt} DESC
      LIMIT 1;
    `;
    db.get(sql, [requesterContactId, recipientUserId], (err, row) => callback(err, row));
  } catch (error) {
    callback(error);
  }
};

const listPendingForRecipient = function (db, recipientUserId, limit, callback) {
  try {
    const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(200, Math.floor(limit))) : 100;
    const sql = `
      SELECT *
      FROM ${tableName}
      WHERE ${columnRecipientUserId} = ?
        AND ${columnStatus} = '${exchangeStatus.PENDING}'
      ORDER BY ${columnCreatedAt} ASC
      LIMIT ?;
    `;
    db.all(sql, [recipientUserId, normalizedLimit], (err, rows) => callback(err, rows ?? []));
  } catch (error) {
    callback(error);
  }
};

const listResolvedForRequester = function (db, requesterUserId, limit, callback) {
  try {
    const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(200, Math.floor(limit))) : 100;
    const sql = `
      SELECT *
      FROM ${tableName}
      WHERE ${columnRequesterUserId} = ?
        AND ${columnStatus} IN ('${exchangeStatus.APPROVED}','${exchangeStatus.DECLINED}')
      ORDER BY COALESCE(${columnDecidedAt}, ${columnCreatedAt}) ASC
      LIMIT ?;
    `;
    db.all(sql, [requesterUserId, normalizedLimit], (err, rows) => callback(err, rows ?? []));
  } catch (error) {
    callback(error);
  }
};

const respond = function (db, exchangeId, recipientUserId, response, callback) {
  try {
    const sql = `
      UPDATE ${tableName}
      SET ${columnStatus} = ?,
          ${columnEncryptedProfilePayload} = ?,
          ${columnResponseSignature} = ?,
          ${columnDecidedAt} = strftime('%s','now'),
          ${columnExpiresAt} = ?
      WHERE ${columnId} = ?
        AND ${columnRecipientUserId} = ?
        AND ${columnStatus} = '${exchangeStatus.PENDING}';
    `;

    db.run(
      sql,
      [
        response.status,
        response.encryptedProfilePayload ?? null,
        response.responseSignature ?? null,
        response.expiresAt,
        exchangeId,
        recipientUserId
      ],
      function (err) {
        callback(err, this?.changes ?? 0);
      }
    );
  } catch (error) {
    callback(error);
  }
};

const deleteByRequesterAndIds = function (db, requesterUserId, exchangeIds, callback) {
  try {
    const normalizedIds = Array.isArray(exchangeIds)
      ? [...new Set(exchangeIds
        .map((id) => (typeof id === 'string' ? id.trim() : ''))
        .filter(Boolean))]
      : [];

    if (!requesterUserId || normalizedIds.length === 0) {
      callback(null, 0);
      return;
    }

    const placeholders = normalizedIds.map(() => '?').join(', ');
    const sql = `
      DELETE FROM ${tableName}
      WHERE ${columnRequesterUserId} = ?
        AND ${columnId} IN (${placeholders})
        AND ${columnStatus} IN ('${exchangeStatus.APPROVED}','${exchangeStatus.DECLINED}');
    `;

    db.run(sql, [requesterUserId, ...normalizedIds], function (err) {
      callback(err, this?.changes ?? 0);
    });
  } catch (error) {
    callback(error);
  }
};

const deleteByUserId = function (db, userId, callback) {
  try {
    const sql = `
      DELETE FROM ${tableName}
      WHERE ${columnRequesterUserId} = ?
         OR ${columnRecipientUserId} = ?;
    `;
    db.run(sql, [userId, userId], function (err) {
      callback(err, this?.changes ?? 0);
    });
  } catch (error) {
    callback(error);
  }
};

const cleanExpired = function (db, callback) {
  try {
    const sql = `
      DELETE FROM ${tableName}
      WHERE ${columnExpiresAt} <= strftime('%s','now');
    `;
    db.run(sql, function (err) {
      callback(err, this?.changes ?? 0);
    });
  } catch (error) {
    callback(error);
  }
};

module.exports = {
  exchangeStatus,
  init,
  createPending,
  getById,
  getActiveByRequesterContact,
  listPendingForRecipient,
  listResolvedForRequester,
  respond,
  deleteByRequesterAndIds,
  deleteByUserId,
  cleanExpired
};
