const crypto = require('crypto');

const tableName = 'tableStickerCategory';

const categoryStatus = {
  ACTIVE: 'active',
  HIDDEN: 'hidden',
  BLOCKED: 'blocked',
  DELETED: 'deleted'
};

const columns = {
  id: 'id',
  name: 'name',
  slug: 'slug',
  previewStickerId: 'previewStickerId',
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
      ${columns.name} TEXT NOT NULL,
      ${columns.slug} TEXT NOT NULL UNIQUE,
      ${columns.previewStickerId} TEXT DEFAULT NULL,
      ${columns.status} TEXT NOT NULL DEFAULT '${categoryStatus.ACTIVE}',
      ${columns.sortOrder} INTEGER NOT NULL DEFAULT 0,
      ${columns.createdAt} INTEGER NOT NULL,
      ${columns.updatedAt} INTEGER NOT NULL,
      ${columns.deletedAt} INTEGER DEFAULT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sticker_category_status
      ON ${tableName}(${columns.status}, ${columns.sortOrder}, ${columns.updatedAt} DESC);
    CREATE INDEX IF NOT EXISTS idx_sticker_category_slug
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
      ${columns.name},
      ${columns.slug},
      ${columns.previewStickerId},
      ${columns.status},
      ${columns.sortOrder},
      ${columns.createdAt},
      ${columns.updatedAt},
      ${columns.deletedAt}
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(sql, [
    id,
    payload?.name ?? '',
    payload?.slug ?? '',
    payload?.previewStickerId ?? null,
    payload?.status ?? categoryStatus.ACTIVE,
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
    where.push(`c.${columns.status} <> ?`);
    params.push(categoryStatus.DELETED);
  }

  if (filters?.status) {
    where.push(`c.${columns.status} = ?`);
    params.push(filters.status);
  }

  if (filters?.query) {
    where.push('(LOWER(c.name) LIKE ? OR LOWER(c.slug) LIKE ?)');
    const query = `%${String(filters.query).trim().toLowerCase()}%`;
    params.push(query, query);
  }

  let sql = `
    SELECT
      c.*,
      (
        SELECT COUNT(1)
        FROM tableStickerPack p
        WHERE p.categoryId = c.${columns.id}
      ) AS packCount,
      (
        SELECT COUNT(1)
        FROM tableSticker s
        INNER JOIN tableStickerPack p2 ON p2.id = s.packId
        WHERE p2.categoryId = c.${columns.id}
      ) AS stickerCount
    FROM ${tableName} c
  `;

  if (where.length > 0) {
    sql += ` WHERE ${where.join(' AND ')}`;
  }

  sql += `
    ORDER BY c.${columns.sortOrder} ASC, LOWER(c.${columns.name}) ASC, c.${columns.createdAt} ASC
  `;

  return { sql, params };
}

function list(db, filters, callback) {
  const { sql, params } = buildListSql(filters);
  db.all(sql, params, (err, rows) => callback(err, rows || []));
}

function getById(db, id, callback) {
  db.get(`
    SELECT
      c.*,
      (
        SELECT COUNT(1)
        FROM tableStickerPack p
        WHERE p.categoryId = c.${columns.id}
      ) AS packCount,
      (
        SELECT COUNT(1)
        FROM tableSticker s
        INNER JOIN tableStickerPack p2 ON p2.id = s.packId
        WHERE p2.categoryId = c.${columns.id}
      ) AS stickerCount
    FROM ${tableName} c
    WHERE c.${columns.id} = ?
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

function update(db, id, fields, callback) {
  const updates = [];
  const params = [];
  const allowedKeys = [
    columns.name,
    columns.slug,
    columns.previewStickerId,
    columns.status,
    columns.sortOrder,
    columns.deletedAt
  ];

  for (const key of allowedKeys) {
    if (!Object.prototype.hasOwnProperty.call(fields || {}, key)) {
      continue;
    }
    updates.push(`${key} = ?`);
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
    [columns.status]: categoryStatus.DELETED,
    [columns.deletedAt]: Date.now(),
    [columns.updatedAt]: Date.now()
  }, callback);
}

module.exports = {
  tableName,
  columns,
  categoryStatus,
  init,
  create,
  list,
  getById,
  existsById,
  update,
  markDeleted
};
