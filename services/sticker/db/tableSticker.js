const crypto = require('crypto');

const tableName = 'tableSticker';

const stickerStatus = {
  ACTIVE: 'active',
  HIDDEN: 'hidden',
  BLOCKED: 'blocked',
  DELETED: 'deleted'
};

const columns = {
  id: 'id',
  packId: 'packId',
  name: 'name',
  slug: 'slug',
  keywords: 'keywords',
  previewPath: 'previewPath',
  previewMimeType: 'previewMimeType',
  chatPath: 'chatPath',
  chatMimeType: 'chatMimeType',
  originalPath: 'originalPath',
  originalMimeType: 'originalMimeType',
  width: 'width',
  height: 'height',
  searchVisible: 'searchVisible',
  status: 'status',
  sortOrder: 'sortOrder',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

function init(db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      ${columns.id} TEXT PRIMARY KEY NOT NULL,
      ${columns.packId} TEXT NOT NULL,
      ${columns.name} TEXT NOT NULL,
      ${columns.slug} TEXT NOT NULL,
      ${columns.keywords} TEXT NOT NULL DEFAULT '[]',
      ${columns.previewPath} TEXT NOT NULL DEFAULT '',
      ${columns.previewMimeType} TEXT NOT NULL DEFAULT '',
      ${columns.chatPath} TEXT NOT NULL DEFAULT '',
      ${columns.chatMimeType} TEXT NOT NULL DEFAULT '',
      ${columns.originalPath} TEXT NOT NULL DEFAULT '',
      ${columns.originalMimeType} TEXT NOT NULL DEFAULT '',
      ${columns.width} INTEGER DEFAULT NULL,
      ${columns.height} INTEGER DEFAULT NULL,
      ${columns.searchVisible} INTEGER NOT NULL DEFAULT 1,
      ${columns.status} TEXT NOT NULL DEFAULT '${stickerStatus.ACTIVE}',
      ${columns.sortOrder} INTEGER NOT NULL DEFAULT 0,
      ${columns.createdAt} INTEGER NOT NULL,
      ${columns.updatedAt} INTEGER NOT NULL,
      ${columns.deletedAt} INTEGER DEFAULT NULL,
      CONSTRAINT fk_sticker_pack
        FOREIGN KEY (${columns.packId}) REFERENCES tableStickerPack(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_sticker_pack
      ON ${tableName}(${columns.packId}, ${columns.sortOrder}, ${columns.updatedAt} DESC);
    CREATE INDEX IF NOT EXISTS idx_sticker_status
      ON ${tableName}(${columns.status}, ${columns.searchVisible}, ${columns.updatedAt} DESC);
    CREATE INDEX IF NOT EXISTS idx_sticker_slug
      ON ${tableName}(${columns.slug});
  `;

  db.exec(sql, (err) => {
    if (err) {
      throw err;
    }
  });
}

function create(db, payload, callback) {
  const now = Number.isFinite(payload?.createdAt) ? payload.createdAt : Date.now();
  const id = payload?.id || crypto.randomUUID();
  const sql = `
    INSERT INTO ${tableName} (
      ${columns.id},
      ${columns.packId},
      ${columns.name},
      ${columns.slug},
      ${columns.keywords},
      ${columns.previewPath},
      ${columns.previewMimeType},
      ${columns.chatPath},
      ${columns.chatMimeType},
      ${columns.originalPath},
      ${columns.originalMimeType},
      ${columns.width},
      ${columns.height},
      ${columns.searchVisible},
      ${columns.status},
      ${columns.sortOrder},
      ${columns.createdAt},
      ${columns.updatedAt},
      ${columns.deletedAt}
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(sql, [
    id,
    payload?.packId ?? '',
    payload?.name ?? '',
    payload?.slug ?? '',
    payload?.keywords ?? '[]',
    payload?.previewPath ?? '',
    payload?.previewMimeType ?? '',
    payload?.chatPath ?? '',
    payload?.chatMimeType ?? '',
    payload?.originalPath ?? '',
    payload?.originalMimeType ?? '',
    payload?.width ?? null,
    payload?.height ?? null,
    payload?.searchVisible ? 1 : 0,
    payload?.status ?? stickerStatus.ACTIVE,
    Number(payload?.sortOrder ?? 0),
    now,
    Number.isFinite(payload?.updatedAt) ? payload.updatedAt : now,
    payload?.deletedAt ?? null
  ], function onInsert(err) {
    if (err) {
      return callback(err);
    }
    return callback(null, { id });
  });
}

function buildListSql(filters = {}) {
  const where = [];
  const params = [];

  if (!filters?.includeDeleted) {
    where.push(`s.${columns.status} <> ?`);
    params.push(stickerStatus.DELETED);
  }

  if (filters?.status) {
    where.push(`s.${columns.status} = ?`);
    params.push(filters.status);
  }

  if (filters?.packId) {
    where.push(`s.${columns.packId} = ?`);
    params.push(filters.packId);
  }

  if (filters?.categoryId) {
    where.push('p.categoryId = ?');
    params.push(filters.categoryId);
  }

  if (filters?.searchVisible !== undefined && filters?.searchVisible !== null) {
    where.push(`s.${columns.searchVisible} = ?`);
    params.push(filters.searchVisible ? 1 : 0);
  }

  if (filters?.query) {
    const query = `%${String(filters.query).trim().toLowerCase()}%`;
    where.push('(LOWER(s.name) LIKE ? OR LOWER(s.slug) LIKE ? OR LOWER(s.keywords) LIKE ?)');
    params.push(query, query, query);
  }

  let sql = `
    SELECT
      s.*,
      p.name AS packName,
      p.slug AS packSlug,
      p.categoryId,
      c.name AS categoryName,
      c.slug AS categorySlug
    FROM ${tableName} s
    INNER JOIN tableStickerPack p ON p.id = s.${columns.packId}
    INNER JOIN tableStickerCategory c ON c.id = p.categoryId
  `;

  if (where.length > 0) {
    sql += ` WHERE ${where.join(' AND ')}`;
  }

  sql += `
    ORDER BY s.${columns.sortOrder} ASC, LOWER(s.${columns.name}) ASC, s.${columns.createdAt} ASC
  `;

  return { sql, params };
}

function list(db, filters, callback) {
  const { sql, params } = buildListSql(filters);
  const limit = Number.isFinite(filters?.limit) ? filters.limit : 200;
  const offset = Number.isFinite(filters?.offset) ? filters.offset : 0;
  db.all(`${sql} LIMIT ? OFFSET ?`, [...params, limit, offset], (err, rows) => callback(err, rows || []));
}

function getById(db, id, callback) {
  db.get(`
    SELECT
      s.*,
      p.name AS packName,
      p.slug AS packSlug,
      p.categoryId,
      c.name AS categoryName,
      c.slug AS categorySlug
    FROM ${tableName} s
    INNER JOIN tableStickerPack p ON p.id = s.${columns.packId}
    INNER JOIN tableStickerCategory c ON c.id = p.categoryId
    WHERE s.${columns.id} = ?
    LIMIT 1
  `, [id], (err, row) => {
    callback(err, row || null);
  });
}

function existsById(db, id, callback) {
  db.get(`SELECT ${columns.id} FROM ${tableName} WHERE ${columns.id} = ? LIMIT 1`, [id], (err, row) => {
    callback(err, Boolean(row?.id));
  });
}

function getByPackAndSlug(db, packId, slug, callback) {
  db.get(`
    SELECT
      s.*,
      p.name AS packName,
      p.slug AS packSlug,
      p.categoryId,
      c.name AS categoryName,
      c.slug AS categorySlug
    FROM ${tableName} s
    INNER JOIN tableStickerPack p ON p.id = s.${columns.packId}
    INNER JOIN tableStickerCategory c ON c.id = p.categoryId
    WHERE s.${columns.packId} = ?
      AND s.${columns.slug} = ?
    LIMIT 1
  `, [packId, slug], (err, row) => {
    callback(err, row || null);
  });
}

function getRenderableById(db, id, callback) {
  db.get(`
    SELECT *
    FROM ${tableName}
    WHERE ${columns.id} = ?
      AND ${columns.status} IN (?, ?)
    LIMIT 1
  `, [id, stickerStatus.ACTIVE, stickerStatus.HIDDEN], (err, row) => {
    callback(err, row || null);
  });
}

function update(db, id, fields, callback) {
  const updates = [];
  const params = [];
  const allowedKeys = [
    columns.packId,
    columns.name,
    columns.slug,
    columns.keywords,
    columns.previewPath,
    columns.previewMimeType,
    columns.chatPath,
    columns.chatMimeType,
    columns.originalPath,
    columns.originalMimeType,
    columns.width,
    columns.height,
    columns.searchVisible,
    columns.status,
    columns.sortOrder,
    columns.deletedAt
  ];

  for (const key of allowedKeys) {
    if (!Object.prototype.hasOwnProperty.call(fields || {}, key)) {
      continue;
    }
    updates.push(`${key} = ?`);
    if (key === columns.searchVisible) {
      params.push(fields[key] ? 1 : 0);
      continue;
    }
    params.push(fields[key]);
  }

  if (updates.length === 0) {
    return process.nextTick(() => callback(null, false));
  }

  updates.push(`${columns.updatedAt} = ?`);
  params.push(Number.isFinite(fields?.updatedAt) ? fields.updatedAt : Date.now());
  params.push(id);

  db.run(`UPDATE ${tableName} SET ${updates.join(', ')} WHERE ${columns.id} = ?`, params, function onUpdate(err) {
    if (err) {
      return callback(err);
    }
    return callback(null, this?.changes > 0);
  });
}

function markDeleted(db, id, callback) {
  update(db, id, {
    [columns.status]: stickerStatus.DELETED,
    [columns.searchVisible]: 0,
    [columns.deletedAt]: Date.now(),
    [columns.updatedAt]: Date.now()
  }, callback);
}

function markDeletedByPack(db, packId, callback) {
  db.run(`
    UPDATE ${tableName}
    SET ${columns.status} = ?,
        ${columns.searchVisible} = 0,
        ${columns.deletedAt} = COALESCE(${columns.deletedAt}, ?),
        ${columns.updatedAt} = ?
    WHERE ${columns.packId} = ?
      AND ${columns.status} <> ?
  `, [stickerStatus.DELETED, Date.now(), Date.now(), packId, stickerStatus.DELETED], function onUpdate(err) {
    if (err) {
      return callback(err);
    }
    return callback(null, Number(this?.changes ?? 0));
  });
}

function markDeletedByCategory(db, categoryId, callback) {
  db.run(`
    UPDATE ${tableName}
    SET ${columns.status} = ?,
        ${columns.searchVisible} = 0,
        ${columns.deletedAt} = COALESCE(${columns.deletedAt}, ?),
        ${columns.updatedAt} = ?
    WHERE ${columns.packId} IN (
      SELECT id
      FROM tableStickerPack
      WHERE categoryId = ?
    )
      AND ${columns.status} <> ?
  `, [stickerStatus.DELETED, Date.now(), Date.now(), categoryId, stickerStatus.DELETED], function onUpdate(err) {
    if (err) {
      return callback(err);
    }
    return callback(null, Number(this?.changes ?? 0));
  });
}

module.exports = {
  tableName,
  columns,
  stickerStatus,
  init,
  create,
  list,
  getById,
  existsById,
  getByPackAndSlug,
  getRenderableById,
  update,
  markDeleted,
  markDeletedByPack,
  markDeletedByCategory
};
