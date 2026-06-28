const tableName = 'tableSecretDrop';
const unlockTableName = 'tableSecretDropUnlock';
const likeTableName = 'tableSecretDropLike';
const dislikeTableName = 'tableSecretDropDislike';
const commentTableName = 'tableSecretDropComment';
const hintTranslationTableName = 'tableSecretDropHintTranslation';

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


function pickRowValue(row, ...keys) {
  for (const key of keys) {
    if (row && row[key] !== undefined) {
      return row[key];
    }
  }
  return undefined;
}

function numberOrDefault(value, fallback = 0) {
  return value === null || value === undefined ? fallback : Number(value);
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
  const includeCryptoMetadata = includeEncryptedPayload || options.includeCryptoMetadata === true;
  const mapped = {
    id: row.id,
    uuid: row.uuid,
    userId: row.userId,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    plusCode: row.plusCode,
    discoveryPlusCode: row.discoveryPlusCode,
    discoveryZoomLevel: Number(pickRowValue(row, 'discoveryZoomLevel', 'discoveryzoomlevel') || 18),
    hint: row.hint || '',
    hintStyle: pickRowValue(row, 'hintStyle', 'hintstyle') || '',
    maxUnlocks: pickRowValue(row, 'maxUnlocks', 'maxunlocks') === null || pickRowValue(row, 'maxUnlocks', 'maxunlocks') === undefined ? null : Number(pickRowValue(row, 'maxUnlocks', 'maxunlocks')),
    unlockCount: Number(pickRowValue(row, 'unlockCount', 'unlockcount') || 0),
    failedUnlockCount: Number(pickRowValue(row, 'failedUnlockCount', 'failedunlockcount') || 0),
    validFrom: pickRowValue(row, 'validFrom', 'validfrom') === null || pickRowValue(row, 'validFrom', 'validfrom') === undefined ? null : Number(pickRowValue(row, 'validFrom', 'validfrom')),
    validUntil: pickRowValue(row, 'validUntil', 'validuntil') === null || pickRowValue(row, 'validUntil', 'validuntil') === undefined ? null : Number(pickRowValue(row, 'validUntil', 'validuntil')),
    status: row.status,
    likes: Number(row.likes || 0),
    dislikes: Number(row.dislikes || 0),
    commentsNumber: Number(pickRowValue(row, 'commentsNumber', 'commentsnumber') || 0),
    createdAt: Number(pickRowValue(row, 'createdAt', 'createdat') || 0),
    updatedAt: Number(pickRowValue(row, 'updatedAt', 'updatedat') || 0),
    lastUnlockedAt: pickRowValue(row, 'lastUnlockedAt', 'lastunlockedat') === null || pickRowValue(row, 'lastUnlockedAt', 'lastunlockedat') === undefined ? null : Number(pickRowValue(row, 'lastUnlockedAt', 'lastunlockedat')),
    consumedAt: pickRowValue(row, 'consumedAt', 'consumedat') === null || pickRowValue(row, 'consumedAt', 'consumedat') === undefined ? null : Number(pickRowValue(row, 'consumedAt', 'consumedat'))
  };
  if (includeCryptoMetadata) {
    mapped.crypto = safeJsonParse(pickRowValue(row, 'crypto'), null);
  }
  if (includeEncryptedPayload) {
    mapped.encryptedPayload = safeJsonParse(pickRowValue(row, 'encryptedPayload', 'encryptedpayload'), pickRowValue(row, 'encryptedPayload', 'encryptedpayload'));
  }
  return mapped;
}

function mapCommentRow(row) {
  if (!row) return null;
  return {
    uuid: row.uuid,
    secretDropUuid: pickRowValue(row, 'secretDropUuid', 'secretdropuuid'),
    userId: row.userId,
    encryptedPayload: safeJsonParse(pickRowValue(row, 'encryptedPayload', 'encryptedpayload'), pickRowValue(row, 'encryptedPayload', 'encryptedpayload')),
    crypto: safeJsonParse(pickRowValue(row, 'crypto'), null),
    createdAt: Number(pickRowValue(row, 'createdAt', 'createdat') || 0),
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
      discoveryZoomLevel INTEGER NOT NULL DEFAULT 18,
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
      if (alterErr && !/(duplicate column|already exists)/i.test(String(alterErr.message || ''))) {
        throw alterErr;
      }
    });
    db.run(`ALTER TABLE ${tableName} ADD COLUMN discoveryZoomLevel INTEGER NOT NULL DEFAULT 18;`, (alterErr) => {
      if (alterErr && !/(duplicate column|already exists)/i.test(String(alterErr.message || ''))) {
        throw alterErr;
      }
    });
  });
};

async function create(db, payload) {
  const sql = `
    INSERT INTO ${tableName} (
      uuid, userId, latitude, longitude, plusCode, discoveryPlusCode, discoveryZoomLevel, hint, hintStyle,
      encryptedPayload, crypto, authVerifierHash, maxUnlocks, validFrom, validUntil, status
    ) VALUES (?, ?, ?, ?, UPPER(?), UPPER(?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `;
  await runQuery(db, sql, [
    payload.uuid,
    payload.userId,
    payload.latitude,
    payload.longitude,
    payload.plusCode,
    payload.discoveryPlusCode,
    payload.discoveryZoomLevel ?? 18,
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


async function updateContent(db, uuid, userId, payload) {
  await runQuery(db, `DELETE FROM ${hintTranslationTableName} WHERE secretDropUuid = ?;`, [uuid]);
  const row = await getQuery(db, `
    UPDATE ${tableName}
    SET latitude = ?,
        longitude = ?,
        plusCode = UPPER(?),
        discoveryPlusCode = UPPER(?),
        discoveryZoomLevel = ?,
        hint = ?,
        hintStyle = ?,
        encryptedPayload = ?,
        crypto = ?,
        authVerifierHash = ?,
        maxUnlocks = ?,
        unlockCount = 0,
        failedUnlockCount = 0,
        validFrom = ?,
        validUntil = ?,
        status = ?,
        lastUnlockedAt = NULL,
        consumedAt = NULL,
        updatedAt = strftime('%s','now')
    WHERE uuid = ?
      AND userId = ?
      AND status <> '${secretDropStatus.DELETED}'
    RETURNING *;
  `, [
    payload.latitude,
    payload.longitude,
    payload.plusCode,
    payload.discoveryPlusCode,
    payload.discoveryZoomLevel ?? 18,
    payload.hint || '',
    payload.hintStyle || '',
    payload.encryptedPayload,
    payload.crypto,
    payload.authVerifierHash,
    payload.maxUnlocks ?? null,
    payload.validFrom ?? null,
    payload.validUntil ?? null,
    payload.status || secretDropStatus.ENABLED,
    uuid,
    userId
  ]);
  return mapSecretDropRow(row, { includeEncryptedPayload: false });
}

async function getByUuid(db, uuid, options = {}) {
  const row = await getQuery(db, `SELECT * FROM ${tableName} WHERE uuid = ? LIMIT 1;`, [uuid]);
  return mapSecretDropRow(row, options);
}

async function getRawByUuid(db, uuid) {
  return getQuery(db, `SELECT * FROM ${tableName} WHERE uuid = ? LIMIT 1;`, [uuid]);
}

async function discoverByPlusCode(db, discoveryPlusCode, nowSeconds, zoomLevel = null) {
  const normalizedZoomLevel = Number.isInteger(Number(zoomLevel)) ? Number(zoomLevel) : null;
  const zoomCondition = normalizedZoomLevel === null ? '' : 'AND discoveryZoomLevel <= ?';
  const params = normalizedZoomLevel === null
    ? [discoveryPlusCode, nowSeconds, nowSeconds]
    : [discoveryPlusCode, normalizedZoomLevel, nowSeconds, nowSeconds];
  const rows = await allQuery(db, `
    SELECT * FROM ${tableName}
    WHERE discoveryPlusCode = UPPER(?)
      ${zoomCondition}
      AND status = '${secretDropStatus.ENABLED}'
      AND (validFrom IS NULL OR validFrom <= ?)
      AND (validUntil IS NULL OR validUntil >= ?)
      AND (maxUnlocks IS NULL OR unlockCount < maxUnlocks)
    ORDER BY createdAt DESC
    LIMIT 25;
  `, params);
  return rows.map((row) => mapSecretDropRow(row, { includeEncryptedPayload: false, includeCryptoMetadata: true }));
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
  const deleted = Number(result.changes || 0) > 0;
  if (deleted) {
    await runQuery(db, `DELETE FROM ${hintTranslationTableName} WHERE secretDropUuid = ?;`, [uuid]);
  }
  return deleted;
}

async function updateStatus(db, uuid, userId, status) {
  const row = await getQuery(db, `
    UPDATE ${tableName}
    SET status = ?, updatedAt = strftime('%s','now')
    WHERE uuid = ?
      AND userId = ?
      AND status NOT IN ('${secretDropStatus.DELETED}', '${secretDropStatus.CONSUMED}')
    RETURNING *;
  `, [status, uuid, userId]);
  return mapSecretDropRow(row, { includeEncryptedPayload: false });
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
  updateContent,
  getByUuid,
  getRawByUuid,
  discoverByPlusCode,
  getByUserId,
  recordFailedUnlock,
  unlock,
  softDelete,
  updateStatus,
  hasSuccessfulUnlock,
  toggleReaction,
  getReactionState,
  createComment,
  getComments,
  secretDropStatus,
  mapSecretDropRow
};
