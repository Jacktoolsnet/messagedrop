const tableName = 'tableSecretDrop';
const unlockTableName = 'tableSecretDropUnlock';
const likeTableName = 'tableSecretDropLike';
const dislikeTableName = 'tableSecretDropDislike';
const commentTableName = 'tableSecretDropComment';

const secretDropStatus = {
  ENABLED: 'enabled',
  DISABLED: 'disabled',
  CONSUMED: 'consumed',
  DELETED: 'deleted'
};

function runQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this || {});
    });
  });
}

function getQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function allQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function safeJsonParse(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mapSecretDropRow(row, options = {}) {
  if (!row) return null;
  const includeEncryptedPayload = options.includeEncryptedPayload === true;
  const mapped = {
    id: row.id,
    uuid: row.uuid,
    userId: row.userId,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    plusCode: row.plusCode,
    discoveryPlusCode: row.discoveryPlusCode,
    hint: row.hint || '',
    hintStyle: row.hintStyle || '',
    maxUnlocks: row.maxUnlocks === null || row.maxUnlocks === undefined ? null : Number(row.maxUnlocks),
    unlockCount: Number(row.unlockCount || 0),
    failedUnlockCount: Number(row.failedUnlockCount || 0),
    validFrom: row.validFrom === null || row.validFrom === undefined ? null : Number(row.validFrom),
    validUntil: row.validUntil === null || row.validUntil === undefined ? null : Number(row.validUntil),
    status: row.status,
    likes: Number(row.likes || 0),
    dislikes: Number(row.dislikes || 0),
    commentsNumber: Number(row.commentsNumber || 0),
    createdAt: Number(row.createdAt || 0),
    updatedAt: Number(row.updatedAt || 0),
    lastUnlockedAt: row.lastUnlockedAt === null || row.lastUnlockedAt === undefined ? null : Number(row.lastUnlockedAt),
    consumedAt: row.consumedAt === null || row.consumedAt === undefined ? null : Number(row.consumedAt)
  };
  if (includeEncryptedPayload) {
    mapped.encryptedPayload = safeJsonParse(row.encryptedPayload, row.encryptedPayload);
    mapped.crypto = safeJsonParse(row.crypto, null);
  }
  return mapped;
}

function mapCommentRow(row) {
  if (!row) return null;
  return {
    uuid: row.uuid,
    secretDropUuid: row.secretDropUuid,
    userId: row.userId,
    encryptedPayload: safeJsonParse(row.encryptedPayload, row.encryptedPayload),
    crypto: safeJsonParse(row.crypto, null),
    createdAt: Number(row.createdAt || 0),
    status: row.status
  };
}

const init = function (db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      userId TEXT NOT NULL,
      latitude NUMBER NOT NULL,
      longitude NUMBER NOT NULL,
      plusCode TEXT NOT NULL,
      discoveryPlusCode TEXT NOT NULL,
      hint TEXT NOT NULL DEFAULT '',
      hintStyle TEXT NOT NULL DEFAULT '',
      encryptedPayload TEXT NOT NULL,
      crypto TEXT NOT NULL,
      authVerifierHash TEXT NOT NULL,
      maxUnlocks INTEGER DEFAULT NULL,
      unlockCount INTEGER NOT NULL DEFAULT 0,
      failedUnlockCount INTEGER NOT NULL DEFAULT 0,
      validFrom INTEGER DEFAULT NULL,
      validUntil INTEGER DEFAULT NULL,
      status TEXT NOT NULL DEFAULT '${secretDropStatus.ENABLED}',
      likes INTEGER NOT NULL DEFAULT 0,
      dislikes INTEGER NOT NULL DEFAULT 0,
      commentsNumber INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updatedAt INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      lastUnlockedAt INTEGER DEFAULT NULL,
      consumedAt INTEGER DEFAULT NULL,
      CONSTRAINT FK_SECRET_DROP_USER FOREIGN KEY (userId)
        REFERENCES tableUser (id)
        ON UPDATE CASCADE ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ${unlockTableName} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      secretDropUuid TEXT NOT NULL,
      userId TEXT DEFAULT NULL,
      success INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      CONSTRAINT FK_SECRET_DROP_UNLOCK_DROP FOREIGN KEY (secretDropUuid)
        REFERENCES ${tableName} (uuid)
        ON UPDATE CASCADE ON DELETE CASCADE,
      CONSTRAINT FK_SECRET_DROP_UNLOCK_USER FOREIGN KEY (userId)
        REFERENCES tableUser (id)
        ON UPDATE CASCADE ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS ${likeTableName} (
      secretDropUuid TEXT NOT NULL,
      userId TEXT NOT NULL,
      createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      PRIMARY KEY (secretDropUuid, userId),
      CONSTRAINT FK_SECRET_DROP_LIKE_DROP FOREIGN KEY (secretDropUuid)
        REFERENCES ${tableName} (uuid)
        ON UPDATE CASCADE ON DELETE CASCADE,
      CONSTRAINT FK_SECRET_DROP_LIKE_USER FOREIGN KEY (userId)
        REFERENCES tableUser (id)
        ON UPDATE CASCADE ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ${dislikeTableName} (
      secretDropUuid TEXT NOT NULL,
      userId TEXT NOT NULL,
      createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      PRIMARY KEY (secretDropUuid, userId),
      CONSTRAINT FK_SECRET_DROP_DISLIKE_DROP FOREIGN KEY (secretDropUuid)
        REFERENCES ${tableName} (uuid)
        ON UPDATE CASCADE ON DELETE CASCADE,
      CONSTRAINT FK_SECRET_DROP_DISLIKE_USER FOREIGN KEY (userId)
        REFERENCES tableUser (id)
        ON UPDATE CASCADE ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ${commentTableName} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      secretDropUuid TEXT NOT NULL,
      userId TEXT NOT NULL,
      encryptedPayload TEXT NOT NULL,
      crypto TEXT DEFAULT NULL,
      status TEXT NOT NULL DEFAULT 'enabled',
      createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      CONSTRAINT FK_SECRET_DROP_COMMENT_DROP FOREIGN KEY (secretDropUuid)
        REFERENCES ${tableName} (uuid)
        ON UPDATE CASCADE ON DELETE CASCADE,
      CONSTRAINT FK_SECRET_DROP_COMMENT_USER FOREIGN KEY (userId)
        REFERENCES tableUser (id)
        ON UPDATE CASCADE ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_secret_drop_discovery ON ${tableName}(discoveryPlusCode, status);
    CREATE INDEX IF NOT EXISTS idx_secret_drop_owner ON ${tableName}(userId, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_secret_drop_unlock_user ON ${unlockTableName}(secretDropUuid, userId, success);
    CREATE INDEX IF NOT EXISTS idx_secret_drop_comment_drop ON ${commentTableName}(secretDropUuid, createdAt ASC);
  `;
  db.exec(sql, (err) => {
    if (err) throw err;
    db.run(`ALTER TABLE ${tableName} ADD COLUMN hintStyle TEXT NOT NULL DEFAULT '';`, (alterErr) => {
      if (alterErr && !/duplicate column/i.test(String(alterErr.message || ''))) {
        throw alterErr;
      }
    });
  });
};

async function create(db, payload) {
  const sql = `
    INSERT INTO ${tableName} (
      uuid, userId, latitude, longitude, plusCode, discoveryPlusCode, hint, hintStyle,
      encryptedPayload, crypto, authVerifierHash, maxUnlocks, validFrom, validUntil, status
    ) VALUES (?, ?, ?, ?, UPPER(?), UPPER(?), ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `;
  await runQuery(db, sql, [
    payload.uuid,
    payload.userId,
    payload.latitude,
    payload.longitude,
    payload.plusCode,
    payload.discoveryPlusCode,
    payload.hint || '',
    payload.hintStyle || '',
    payload.encryptedPayload,
    payload.crypto,
    payload.authVerifierHash,
    payload.maxUnlocks ?? null,
    payload.validFrom ?? null,
    payload.validUntil ?? null,
    payload.status || secretDropStatus.ENABLED
  ]);
  return getByUuid(db, payload.uuid, { includeEncryptedPayload: false });
}

async function getByUuid(db, uuid, options = {}) {
  const row = await getQuery(db, `SELECT * FROM ${tableName} WHERE uuid = ? LIMIT 1;`, [uuid]);
  return mapSecretDropRow(row, options);
}

async function getRawByUuid(db, uuid) {
  return getQuery(db, `SELECT * FROM ${tableName} WHERE uuid = ? LIMIT 1;`, [uuid]);
}

async function discoverByPlusCode(db, discoveryPlusCode, nowSeconds) {
  const rows = await allQuery(db, `
    SELECT * FROM ${tableName}
    WHERE discoveryPlusCode = UPPER(?)
      AND status = '${secretDropStatus.ENABLED}'
      AND (validFrom IS NULL OR validFrom <= ?)
      AND (validUntil IS NULL OR validUntil >= ?)
      AND (maxUnlocks IS NULL OR unlockCount < maxUnlocks)
    ORDER BY createdAt DESC
    LIMIT 25;
  `, [discoveryPlusCode, nowSeconds, nowSeconds]);
  return rows.map((row) => mapSecretDropRow(row, { includeEncryptedPayload: false }));
}

async function getByUserId(db, userId) {
  const rows = await allQuery(db, `
    SELECT * FROM ${tableName}
    WHERE userId = ?
      AND status <> '${secretDropStatus.DELETED}'
    ORDER BY createdAt DESC;
  `, [userId]);
  return rows.map((row) => mapSecretDropRow(row, { includeEncryptedPayload: false }));
}

async function recordFailedUnlock(db, uuid, userId = null) {
  await db.transaction(async (tx) => {
    await runQuery(tx, `
      INSERT INTO ${unlockTableName} (secretDropUuid, userId, success)
      VALUES (?, ?, 0);
    `, [uuid, userId || null]);
    await runQuery(tx, `
      UPDATE ${tableName}
      SET failedUnlockCount = failedUnlockCount + 1,
          updatedAt = strftime('%s','now')
      WHERE uuid = ?;
    `, [uuid]);
  });
}

async function unlock(db, uuid, authVerifierHash, userId, nowSeconds) {
  return db.transaction(async (tx) => {
    const updated = await getQuery(tx, `
      UPDATE ${tableName}
      SET unlockCount = unlockCount + 1,
          lastUnlockedAt = ?,
          consumedAt = CASE
            WHEN maxUnlocks IS NOT NULL AND unlockCount + 1 >= maxUnlocks THEN ?
            ELSE consumedAt
          END,
          status = CASE
            WHEN maxUnlocks IS NOT NULL AND unlockCount + 1 >= maxUnlocks THEN '${secretDropStatus.CONSUMED}'
            ELSE status
          END,
          updatedAt = ?
      WHERE uuid = ?
        AND authVerifierHash = ?
        AND status = '${secretDropStatus.ENABLED}'
        AND (validFrom IS NULL OR validFrom <= ?)
        AND (validUntil IS NULL OR validUntil >= ?)
        AND (maxUnlocks IS NULL OR unlockCount < maxUnlocks)
      RETURNING *;
    `, [nowSeconds, nowSeconds, nowSeconds, uuid, authVerifierHash, nowSeconds, nowSeconds]);

    if (!updated) {
      return null;
    }

    await runQuery(tx, `
      INSERT INTO ${unlockTableName} (secretDropUuid, userId, success)
      VALUES (?, ?, 1);
    `, [uuid, userId || null]);

    return mapSecretDropRow(updated, { includeEncryptedPayload: true });
  });
}

async function softDelete(db, uuid, userId) {
  const result = await runQuery(db, `
    UPDATE ${tableName}
    SET status = '${secretDropStatus.DELETED}', updatedAt = strftime('%s','now')
    WHERE uuid = ? AND userId = ?;
  `, [uuid, userId]);
  return Number(result.changes || 0) > 0;
}

async function hasSuccessfulUnlock(db, uuid, userId) {
  if (!userId) return false;
  const row = await getQuery(db, `
    SELECT 1 FROM ${unlockTableName}
    WHERE secretDropUuid = ? AND userId = ? AND success = 1
    LIMIT 1;
  `, [uuid, userId]);
  return !!row;
}

async function toggleReaction(db, uuid, userId, reaction) {
  const table = reaction === 'like' ? likeTableName : dislikeTableName;
  const opposite = reaction === 'like' ? dislikeTableName : likeTableName;
  return db.transaction(async (tx) => {
    const deleted = await runQuery(tx, `DELETE FROM ${table} WHERE secretDropUuid = ? AND userId = ?;`, [uuid, userId]);
    if (Number(deleted.changes || 0) === 0) {
      await runQuery(tx, `DELETE FROM ${opposite} WHERE secretDropUuid = ? AND userId = ?;`, [uuid, userId]);
      await runQuery(tx, `INSERT INTO ${table} (secretDropUuid, userId) VALUES (?, ?) ON CONFLICT(secretDropUuid, userId) DO NOTHING;`, [uuid, userId]);
    }
    const counts = await getQuery(tx, `
      SELECT
        (SELECT COUNT(*) FROM ${likeTableName} WHERE secretDropUuid = ?) AS likes,
        (SELECT COUNT(*) FROM ${dislikeTableName} WHERE secretDropUuid = ?) AS dislikes;
    `, [uuid, uuid]);
    await runQuery(tx, `UPDATE ${tableName} SET likes = ?, dislikes = ?, updatedAt = strftime('%s','now') WHERE uuid = ?;`, [counts.likes || 0, counts.dislikes || 0, uuid]);
    return { likes: Number(counts.likes || 0), dislikes: Number(counts.dislikes || 0) };
  });
}

async function getReactionState(db, uuid, userId = null) {
  const counts = await getQuery(db, `
    SELECT
      (SELECT COUNT(*) FROM ${likeTableName} WHERE secretDropUuid = ?) AS likes,
      (SELECT COUNT(*) FROM ${dislikeTableName} WHERE secretDropUuid = ?) AS dislikes;
  `, [uuid, uuid]);
  let liked = false;
  let disliked = false;
  if (userId) {
    liked = !!await getQuery(db, `SELECT 1 FROM ${likeTableName} WHERE secretDropUuid = ? AND userId = ? LIMIT 1;`, [uuid, userId]);
    disliked = !!await getQuery(db, `SELECT 1 FROM ${dislikeTableName} WHERE secretDropUuid = ? AND userId = ? LIMIT 1;`, [uuid, userId]);
  }
  return { likes: Number(counts?.likes || 0), dislikes: Number(counts?.dislikes || 0), liked, disliked };
}

async function createComment(db, comment) {
  return db.transaction(async (tx) => {
    await runQuery(tx, `
      INSERT INTO ${commentTableName} (uuid, secretDropUuid, userId, encryptedPayload, crypto)
      VALUES (?, ?, ?, ?, ?);
    `, [comment.uuid, comment.secretDropUuid, comment.userId, comment.encryptedPayload, comment.crypto || null]);
    await runQuery(tx, `
      UPDATE ${tableName}
      SET commentsNumber = commentsNumber + 1, updatedAt = strftime('%s','now')
      WHERE uuid = ?;
    `, [comment.secretDropUuid]);
    const row = await getQuery(tx, `SELECT * FROM ${commentTableName} WHERE uuid = ? LIMIT 1;`, [comment.uuid]);
    return mapCommentRow(row);
  });
}

async function getComments(db, uuid) {
  const rows = await allQuery(db, `
    SELECT * FROM ${commentTableName}
    WHERE secretDropUuid = ? AND status = 'enabled'
    ORDER BY createdAt ASC;
  `, [uuid]);
  return rows.map(mapCommentRow);
}

module.exports = {
  init,
  create,
  getByUuid,
  getRawByUuid,
  discoverByPlusCode,
  getByUserId,
  recordFailedUnlock,
  unlock,
  softDelete,
  hasSuccessfulUnlock,
  toggleReaction,
  getReactionState,
  createComment,
  getComments,
  secretDropStatus,
  mapSecretDropRow
};
