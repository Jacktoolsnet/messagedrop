const tableName = 'tableSecretDrop';
const unlockTableName = 'tableSecretDropUnlock';
const likeTableName = 'tableSecretDropLike';
const dislikeTableName = 'tableSecretDropDislike';
const commentTableName = 'tableSecretDropComment';
const commentLikeTableName = 'tableSecretDropCommentLike';
const commentDislikeTableName = 'tableSecretDropCommentDislike';
const hintTranslationTableName = 'tableSecretDropHintTranslation';
const recipientTableName = 'tableSecretDropRecipient';

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
    visibility: pickRowValue(row, 'visibility') || 'public',
    creatorMode: pickRowValue(row, 'creatorMode', 'creatormode') || 'normal',
    recipientUserIds: Array.isArray(row.recipientUserIds) ? row.recipientUserIds : [],
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
    parentCommentUuid: pickRowValue(row, 'parentCommentUuid', 'parentcommentuuid') || null,
    likes: Number(pickRowValue(row, 'likes') || 0),
    dislikes: Number(pickRowValue(row, 'dislikes') || 0),
    commentsNumber: Number(pickRowValue(row, 'commentsNumber', 'commentsnumber') || 0),
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
      visibility TEXT NOT NULL DEFAULT 'public',
      creatorMode TEXT NOT NULL DEFAULT 'normal',
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
      parentCommentUuid TEXT DEFAULT NULL,
      likes INTEGER NOT NULL DEFAULT 0,
      dislikes INTEGER NOT NULL DEFAULT 0,
      commentsNumber INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'enabled',
      createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      CONSTRAINT FK_SECRET_DROP_COMMENT_DROP FOREIGN KEY (secretDropUuid)
        REFERENCES ${tableName} (uuid)
        ON UPDATE CASCADE ON DELETE CASCADE,
      CONSTRAINT FK_SECRET_DROP_COMMENT_USER FOREIGN KEY (userId)
        REFERENCES tableUser (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
      CONSTRAINT FK_SECRET_DROP_COMMENT_PARENT FOREIGN KEY (parentCommentUuid)
        REFERENCES ${commentTableName} (uuid)
        ON UPDATE CASCADE ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ${commentLikeTableName} (
      commentUuid TEXT NOT NULL,
      userId TEXT NOT NULL,
      createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      PRIMARY KEY (commentUuid, userId),
      CONSTRAINT FK_SECRET_DROP_COMMENT_LIKE_COMMENT FOREIGN KEY (commentUuid)
        REFERENCES ${commentTableName} (uuid)
        ON UPDATE CASCADE ON DELETE CASCADE,
      CONSTRAINT FK_SECRET_DROP_COMMENT_LIKE_USER FOREIGN KEY (userId)
        REFERENCES tableUser (id)
        ON UPDATE CASCADE ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ${commentDislikeTableName} (
      commentUuid TEXT NOT NULL,
      userId TEXT NOT NULL,
      createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      PRIMARY KEY (commentUuid, userId),
      CONSTRAINT FK_SECRET_DROP_COMMENT_DISLIKE_COMMENT FOREIGN KEY (commentUuid)
        REFERENCES ${commentTableName} (uuid)
        ON UPDATE CASCADE ON DELETE CASCADE,
      CONSTRAINT FK_SECRET_DROP_COMMENT_DISLIKE_USER FOREIGN KEY (userId)
        REFERENCES tableUser (id)
        ON UPDATE CASCADE ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ${recipientTableName} (
      secretDropUuid TEXT NOT NULL,
      recipientUserId TEXT NOT NULL,
      createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      PRIMARY KEY (secretDropUuid, recipientUserId),
      CONSTRAINT FK_SECRET_DROP_RECIPIENT_DROP FOREIGN KEY (secretDropUuid)
        REFERENCES ${tableName} (uuid)
        ON UPDATE CASCADE ON DELETE CASCADE,
      CONSTRAINT FK_SECRET_DROP_RECIPIENT_USER FOREIGN KEY (recipientUserId)
        REFERENCES tableUser (id)
        ON UPDATE CASCADE ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_secret_drop_recipient ON ${recipientTableName}(recipientUserId, secretDropUuid);
    CREATE INDEX IF NOT EXISTS idx_secret_drop_discovery ON ${tableName}(discoveryPlusCode, status);
    CREATE INDEX IF NOT EXISTS idx_secret_drop_owner ON ${tableName}(userId, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_secret_drop_unlock_user ON ${unlockTableName}(secretDropUuid, userId, success);
    CREATE INDEX IF NOT EXISTS idx_secret_drop_comment_drop ON ${commentTableName}(secretDropUuid, createdAt ASC);
    CREATE INDEX IF NOT EXISTS idx_secret_drop_comment_parent ON ${commentTableName}(parentCommentUuid, createdAt ASC);
  `;
  db.exec(sql, (err) => {
    if (err) throw err;
  });
};

async function create(db, payload) {
  const sql = `
    INSERT INTO ${tableName} (
      uuid, userId, latitude, longitude, plusCode, discoveryPlusCode, discoveryZoomLevel, hint, hintStyle,
      encryptedPayload, crypto, authVerifierHash, maxUnlocks, validFrom, validUntil, status, visibility, creatorMode
    ) VALUES (?, ?, ?, ?, UPPER(?), UPPER(?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
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
    payload.status || secretDropStatus.ENABLED,
    payload.visibility || 'public',
    payload.creatorMode || 'normal'
  ]);
  await setRecipients(db, payload.uuid, payload.recipientUserIds || []);
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
        visibility = ?,
        creatorMode = ?,
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
    payload.visibility || 'public',
    payload.creatorMode || 'normal',
    uuid,
    userId
  ]);
  if (row) {
    await setRecipients(db, uuid, payload.recipientUserIds || []);
  }
  return mapSecretDropRow(row, { includeEncryptedPayload: false });
}

async function setRecipients(db, secretDropUuid, recipientUserIds = []) {
  await runQuery(db, `DELETE FROM ${recipientTableName} WHERE secretDropUuid = ?;`, [secretDropUuid]);
  const uniqueIds = [...new Set((recipientUserIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  for (const recipientUserId of uniqueIds) {
    await runQuery(db, `INSERT INTO ${recipientTableName} (secretDropUuid, recipientUserId) VALUES (?, ?) ON CONFLICT(secretDropUuid, recipientUserId) DO NOTHING;`, [secretDropUuid, recipientUserId]);
  }
}

async function getValidContactRecipientUserIds(db, ownerUserId, recipientUserIds = []) {
  const uniqueIds = [...new Set((recipientUserIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return [];
  const placeholders = uniqueIds.map(() => '?').join(',');
  const rows = await allQuery(db, `
    SELECT contactUserId FROM tableContact
    WHERE userId = ?
      AND COALESCE(status, 'active') = 'active'
      AND contactUserId IN (${placeholders});
  `, [ownerUserId, ...uniqueIds]);
  const valid = new Set(rows.map((row) => row.contactUserId));
  return uniqueIds.filter((id) => valid.has(id));
}

async function attachRecipients(db, drops) {
  if (!Array.isArray(drops) || drops.length === 0) return drops;
  const uuids = drops.map((drop) => drop.uuid).filter(Boolean);
  if (uuids.length === 0) return drops;
  const placeholders = uuids.map(() => '?').join(',');
  const rows = await allQuery(db, `SELECT secretDropUuid, recipientUserId FROM ${recipientTableName} WHERE secretDropUuid IN (${placeholders});`, uuids);
  const byDrop = new Map();
  for (const row of rows) {
    const list = byDrop.get(row.secretDropUuid) || [];
    list.push(row.recipientUserId);
    byDrop.set(row.secretDropUuid, list);
  }
  return drops.map((drop) => ({ ...drop, recipientUserIds: byDrop.get(drop.uuid) || [] }));
}

async function getByUuid(db, uuid, options = {}) {
  const row = await getQuery(db, `SELECT * FROM ${tableName} WHERE uuid = ? LIMIT 1;`, [uuid]);
  return mapSecretDropRow(row, options);
}

async function getRawByUuid(db, uuid) {
  return getQuery(db, `SELECT * FROM ${tableName} WHERE uuid = ? LIMIT 1;`, [uuid]);
}

async function discoverByPlusCode(db, discoveryPlusCode, nowSeconds, zoomLevel = null, userId = null) {
  const normalizedZoomLevel = Number.isInteger(Number(zoomLevel)) ? Number(zoomLevel) : null;
  const zoomCondition = normalizedZoomLevel === null ? '' : 'AND discoveryZoomLevel <= ?';
  const params = normalizedZoomLevel === null
    ? [discoveryPlusCode]
    : [discoveryPlusCode, normalizedZoomLevel];
  const visibilityCondition = userId
    ? `AND (COALESCE(visibility, 'public') = 'public' OR userId = ? OR EXISTS (SELECT 1 FROM ${recipientTableName} r WHERE r.secretDropUuid = ${tableName}.uuid AND r.recipientUserId = ?))`
    : `AND COALESCE(visibility, 'public') = 'public'`;
  const visibilityParams = userId ? [userId, userId] : [];
  const rows = await allQuery(db, `
    SELECT * FROM ${tableName}
    WHERE discoveryPlusCode = UPPER(?)
      ${zoomCondition}
      ${visibilityCondition}
      AND status = '${secretDropStatus.ENABLED}'
      AND (validFrom IS NULL OR validFrom <= ?)
      AND (validUntil IS NULL OR validUntil >= ?)
      AND (maxUnlocks IS NULL OR unlockCount < maxUnlocks)
    ORDER BY createdAt DESC
    LIMIT 25;
  `, [...params, ...visibilityParams, nowSeconds, nowSeconds]);
  return rows.map((row) => mapSecretDropRow(row, { includeEncryptedPayload: false, includeCryptoMetadata: true }));
}

async function getByUserId(db, userId) {
  const rows = await allQuery(db, `
    SELECT * FROM ${tableName}
    WHERE userId = ?
      AND status <> '${secretDropStatus.DELETED}'
      AND COALESCE(creatorMode, 'normal') <> 'incognito'
    ORDER BY createdAt DESC;
  `, [userId]);
  return attachRecipients(db, rows.map((row) => mapSecretDropRow(row, { includeEncryptedPayload: false })));
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
    await runQuery(db, `DELETE FROM ${recipientTableName} WHERE secretDropUuid = ?;`, [uuid]);
  }
  return deleted;
}

async function updateStatus(db, uuid, userId, status) {
  const isPublishing = status === secretDropStatus.ENABLED;
  const row = await getQuery(db, `
    UPDATE ${tableName}
    SET status = ?,
        unlockCount = CASE WHEN ? THEN 0 ELSE unlockCount END,
        failedUnlockCount = CASE WHEN ? THEN 0 ELSE failedUnlockCount END,
        lastUnlockedAt = CASE WHEN ? THEN NULL ELSE lastUnlockedAt END,
        consumedAt = CASE WHEN ? THEN NULL ELSE consumedAt END,
        updatedAt = strftime('%s','now')
    WHERE uuid = ?
      AND userId = ?
      AND status <> '${secretDropStatus.DELETED}'
    RETURNING *;
  `, [status, isPublishing, isPublishing, isPublishing, isPublishing, uuid, userId]);
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
    if (comment.parentCommentUuid) {
      const parent = await getQuery(tx, `SELECT * FROM ${commentTableName} WHERE uuid = ? AND secretDropUuid = ? AND status = 'enabled' LIMIT 1;`, [comment.parentCommentUuid, comment.secretDropUuid]);
      if (!parent) {
        const error = new Error('secret_drop_comment_parent_not_found');
        error.status = 404;
        throw error;
      }
    }
    await runQuery(tx, `
      INSERT INTO ${commentTableName} (uuid, secretDropUuid, userId, encryptedPayload, crypto, parentCommentUuid)
      VALUES (?, ?, ?, ?, ?, ?);
    `, [comment.uuid, comment.secretDropUuid, comment.userId, comment.encryptedPayload, comment.crypto || null, comment.parentCommentUuid || null]);
    if (comment.parentCommentUuid) {
      await runQuery(tx, `
        UPDATE ${commentTableName}
        SET commentsNumber = commentsNumber + 1
        WHERE uuid = ?;
      `, [comment.parentCommentUuid]);
    } else {
      await runQuery(tx, `
        UPDATE ${tableName}
        SET commentsNumber = commentsNumber + 1, updatedAt = strftime('%s','now')
        WHERE uuid = ?;
      `, [comment.secretDropUuid]);
    }
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

async function getCommentByUuid(db, commentUuid) {
  const row = await getQuery(db, `SELECT * FROM ${commentTableName} WHERE uuid = ? AND status = 'enabled' LIMIT 1;`, [commentUuid]);
  return mapCommentRow(row);
}

async function updateComment(db, secretDropUuid, commentUuid, userId, payload) {
  const row = await getQuery(db, `
    UPDATE ${commentTableName}
    SET encryptedPayload = ?,
        crypto = ?
    WHERE uuid = ?
      AND secretDropUuid = ?
      AND userId = ?
      AND status = 'enabled'
    RETURNING *;
  `, [payload.encryptedPayload, payload.crypto || null, commentUuid, secretDropUuid, userId]);
  return mapCommentRow(row);
}

async function deleteComment(db, secretDropUuid, commentUuid, userId) {
  return db.transaction(async (tx) => {
    const comment = await getQuery(tx, `
      SELECT * FROM ${commentTableName}
      WHERE uuid = ? AND secretDropUuid = ? AND userId = ? AND status = 'enabled'
      LIMIT 1;
    `, [commentUuid, secretDropUuid, userId]);
    if (!comment) {
      return false;
    }

    await runQuery(tx, `
      DELETE FROM ${commentLikeTableName}
      WHERE commentUuid IN (
        WITH RECURSIVE descendants(uuid) AS (
          SELECT uuid FROM ${commentTableName} WHERE uuid = ?
          UNION ALL
          SELECT child.uuid
          FROM ${commentTableName} child
          INNER JOIN descendants parent ON child.parentCommentUuid = parent.uuid
        )
        SELECT uuid FROM descendants
      );
    `, [commentUuid]);
    await runQuery(tx, `
      DELETE FROM ${commentDislikeTableName}
      WHERE commentUuid IN (
        WITH RECURSIVE descendants(uuid) AS (
          SELECT uuid FROM ${commentTableName} WHERE uuid = ?
          UNION ALL
          SELECT child.uuid
          FROM ${commentTableName} child
          INNER JOIN descendants parent ON child.parentCommentUuid = parent.uuid
        )
        SELECT uuid FROM descendants
      );
    `, [commentUuid]);
    await runQuery(tx, `
      UPDATE ${commentTableName}
      SET status = 'deleted'
      WHERE uuid IN (
        WITH RECURSIVE descendants(uuid) AS (
          SELECT uuid FROM ${commentTableName} WHERE uuid = ?
          UNION ALL
          SELECT child.uuid
          FROM ${commentTableName} child
          INNER JOIN descendants parent ON child.parentCommentUuid = parent.uuid
        )
        SELECT uuid FROM descendants
      );
    `, [commentUuid]);

    const parentCommentUuid = pickRowValue(comment, 'parentCommentUuid', 'parentcommentuuid') || null;
    if (parentCommentUuid) {
      await runQuery(tx, `
        UPDATE ${commentTableName}
        SET commentsNumber = CASE WHEN commentsNumber > 0 THEN commentsNumber - 1 ELSE 0 END
        WHERE uuid = ?;
      `, [parentCommentUuid]);
    } else {
      await runQuery(tx, `
        UPDATE ${tableName}
        SET commentsNumber = CASE WHEN commentsNumber > 0 THEN commentsNumber - 1 ELSE 0 END,
            updatedAt = strftime('%s','now')
        WHERE uuid = ?;
      `, [secretDropUuid]);
    }
    return true;
  });
}

async function toggleCommentReaction(db, commentUuid, userId, reaction) {
  const table = reaction === 'like' ? commentLikeTableName : commentDislikeTableName;
  const opposite = reaction === 'like' ? commentDislikeTableName : commentLikeTableName;
  return db.transaction(async (tx) => {
    const comment = await getQuery(tx, `SELECT * FROM ${commentTableName} WHERE uuid = ? AND status = 'enabled' LIMIT 1;`, [commentUuid]);
    if (!comment) {
      const error = new Error('secret_drop_comment_not_found');
      error.status = 404;
      throw error;
    }
    const deleted = await runQuery(tx, `DELETE FROM ${table} WHERE commentUuid = ? AND userId = ?;`, [commentUuid, userId]);
    if (Number(deleted.changes || 0) === 0) {
      await runQuery(tx, `DELETE FROM ${opposite} WHERE commentUuid = ? AND userId = ?;`, [commentUuid, userId]);
      await runQuery(tx, `INSERT INTO ${table} (commentUuid, userId) VALUES (?, ?) ON CONFLICT(commentUuid, userId) DO NOTHING;`, [commentUuid, userId]);
    }
    const counts = await getQuery(tx, `
      SELECT
        (SELECT COUNT(*) FROM ${commentLikeTableName} WHERE commentUuid = ?) AS likes,
        (SELECT COUNT(*) FROM ${commentDislikeTableName} WHERE commentUuid = ?) AS dislikes;
    `, [commentUuid, commentUuid]);
    await runQuery(tx, `UPDATE ${commentTableName} SET likes = ?, dislikes = ? WHERE uuid = ?;`, [counts.likes || 0, counts.dislikes || 0, commentUuid]);
    return { likes: Number(counts.likes || 0), dislikes: Number(counts.dislikes || 0) };
  });
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
  getCommentByUuid,
  updateComment,
  deleteComment,
  toggleCommentReaction,
  secretDropStatus,
  getValidContactRecipientUserIds,
  mapSecretDropRow
};
