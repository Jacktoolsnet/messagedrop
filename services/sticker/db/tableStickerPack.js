const crypto = require('crypto');

const tableName = 'tableStickerPack';

const packStatus = {
  ACTIVE: 'active',
  HIDDEN: 'hidden',
  BLOCKED: 'blocked',
  DELETED: 'deleted'
};

const columns = {
  id: 'id',
  categoryId: 'categoryId',
  name: 'name',
  slug: 'slug',
  previewStickerId: 'previewStickerId',
  sourceProvider: 'sourceProvider',
  sourceReference: 'sourceReference',
  sourceMetadataJson: 'sourceMetadataJson',
  licenseNote: 'licenseNote',
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
      ${columns.categoryId} TEXT NOT NULL,
      ${columns.name} TEXT NOT NULL,
      ${columns.slug} TEXT NOT NULL UNIQUE,
      ${columns.previewStickerId} TEXT DEFAULT NULL,
      ${columns.sourceProvider} TEXT NOT NULL DEFAULT 'manual',
      ${columns.sourceReference} TEXT NOT NULL DEFAULT '',
      ${columns.sourceMetadataJson} TEXT NOT NULL DEFAULT '',
      ${columns.licenseNote} TEXT NOT NULL DEFAULT '',
      ${columns.searchVisible} INTEGER NOT NULL DEFAULT 1,
      ${columns.status} TEXT NOT NULL DEFAULT '${packStatus.ACTIVE}',
      ${columns.sortOrder} INTEGER NOT NULL DEFAULT 0,
      ${columns.createdAt} INTEGER NOT NULL,
      ${columns.updatedAt} INTEGER NOT NULL,
      ${columns.deletedAt} INTEGER DEFAULT NULL,
      CONSTRAINT fk_sticker_pack_category
        FOREIGN KEY (${columns.categoryId}) REFERENCES tableStickerCategory(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_sticker_pack_category
      ON ${tableName}(${columns.categoryId}, ${columns.sortOrder}, ${columns.updatedAt} DESC);
    CREATE INDEX IF NOT EXISTS idx_sticker_pack_status
      ON ${tableName}(${columns.status}, ${columns.searchVisible}, ${columns.updatedAt} DESC);
  `;

  db.exec(sql, (err) => {
    if (err) {
      throw err;
    }
  });

  db.exec(`
    ALTER TABLE ${tableName} ADD COLUMN ${columns.sourceMetadataJson} TEXT NOT NULL DEFAULT '';
  `, (err) => {
    if (err && !String(err.message || err).includes('duplicate column name')) {
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
      ${columns.categoryId},
      ${columns.name},
      ${columns.slug},
      ${columns.previewStickerId},
      ${columns.sourceProvider},
      ${columns.sourceReference},
      ${columns.sourceMetadataJson},
      ${columns.licenseNote},
      ${columns.searchVisible},
      ${columns.status},
      ${columns.sortOrder},
      ${columns.createdAt},
      ${columns.updatedAt},
      ${columns.deletedAt}
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(sql, [
    id,
    payload?.categoryId ?? '',
    payload?.name ?? '',
    payload?.slug ?? '',
    payload?.previewStickerId ?? null,
    payload?.sourceProvider ?? 'manual',
    payload?.sourceReference ?? '',
    payload?.sourceMetadataJson ?? '',
    payload?.licenseNote ?? '',
    payload?.searchVisible ? 1 : 0,
    payload?.status ?? packStatus.ACTIVE,
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
    where.push(`p.${columns.status} <> ?`);
    params.push(packStatus.DELETED);
  }

  if (filters?.status) {
    where.push(`p.${columns.status} = ?`);
    params.push(filters.status);
  }

  if (filters?.categoryId) {
    where.push(`p.${columns.categoryId} = ?`);
    params.push(filters.categoryId);
  }

  if (filters?.searchVisible !== undefined && filters?.searchVisible !== null) {
    where.push(`p.${columns.searchVisible} = ?`);
    params.push(filters.searchVisible ? 1 : 0);
  }

  if (filters?.query) {
    where.push('(LOWER(p.name) LIKE ? OR LOWER(p.slug) LIKE ?)');
    const query = `%${String(filters.query).trim().toLowerCase()}%`;
    params.push(query, query);
  }

  let sql = `
    SELECT
      p.*,
      c.name AS categoryName,
      c.slug AS categorySlug,
      (
        SELECT COUNT(1)
        FROM tableSticker s
        WHERE s.packId = p.${columns.id}
      ) AS stickerCount
    FROM ${tableName} p
    INNER JOIN tableStickerCategory c ON c.id = p.${columns.categoryId}
  `;

  if (where.length > 0) {
    sql += ` WHERE ${where.join(' AND ')}`;
  }

  sql += `
    ORDER BY p.${columns.sortOrder} ASC, LOWER(p.${columns.name}) ASC, p.${columns.createdAt} ASC
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
      p.*,
      c.name AS categoryName,
      c.slug AS categorySlug,
      (
        SELECT COUNT(1)
        FROM tableSticker s
        WHERE s.packId = p.${columns.id}
      ) AS stickerCount
    FROM ${tableName} p
    INNER JOIN tableStickerCategory c ON c.id = p.${columns.categoryId}
    WHERE p.${columns.id} = ?
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
    columns.categoryId,
    columns.name,
    columns.slug,
    columns.previewStickerId,
    columns.sourceProvider,
    columns.sourceReference,
    columns.sourceMetadataJson,
    columns.licenseNote,
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
    [columns.status]: packStatus.DELETED,
    [columns.searchVisible]: 0,
    [columns.deletedAt]: Date.now(),
    [columns.updatedAt]: Date.now()
  }, callback);
}

function markDeletedByCategory(db, categoryId, callback) {
  db.run(`
    UPDATE ${tableName}
    SET ${columns.status} = ?,
        ${columns.searchVisible} = 0,
        ${columns.deletedAt} = COALESCE(${columns.deletedAt}, ?),
        ${columns.updatedAt} = ?
    WHERE ${columns.categoryId} = ?
      AND ${columns.status} <> ?
  `, [packStatus.DELETED, Date.now(), Date.now(), categoryId, packStatus.DELETED], function onUpdate(err) {
    if (err) {
      return callback(err);
    }
    return callback(null, Number(this?.changes ?? 0));
  });
}

module.exports = {
  tableName,
  columns,
  packStatus,
  init,
  create,
  list,
  getById,
  existsById,
  update,
  markDeleted,
  markDeletedByCategory
};
