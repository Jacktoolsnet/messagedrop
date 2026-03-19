const crypto = require('crypto');

const tableName = 'tablePublicContent';
const adminUserTableName = 'tableUser';

const contentStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  WITHDRAWN: 'withdrawn',
  DELETED: 'deleted'
};

const columns = {
  id: 'id',
  authorAdminUserId: 'authorAdminUserId',
  lastEditorAdminUserId: 'lastEditorAdminUserId',
  publisherAdminUserId: 'publisherAdminUserId',
  publisherPublicUserId: 'publisherPublicUserId',
  publishedMessageId: 'publishedMessageId',
  publishedMessageUuid: 'publishedMessageUuid',
  status: 'status',
  message: 'message',
  latitude: 'latitude',
  longitude: 'longitude',
  plusCode: 'plusCode',
  locationLabel: 'locationLabel',
  markerType: 'markerType',
  style: 'style',
  hashtags: 'hashtags',
  multimedia: 'multimedia',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  publishedAt: 'publishedAt',
  withdrawnAt: 'withdrawnAt',
  deletedAt: 'deletedAt'
};

function init(db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      ${columns.id} TEXT PRIMARY KEY NOT NULL,
      ${columns.authorAdminUserId} TEXT NOT NULL,
      ${columns.lastEditorAdminUserId} TEXT DEFAULT NULL,
      ${columns.publisherAdminUserId} TEXT DEFAULT NULL,
      ${columns.publisherPublicUserId} TEXT DEFAULT NULL,
      ${columns.publishedMessageId} INTEGER DEFAULT NULL,
      ${columns.publishedMessageUuid} TEXT DEFAULT NULL,
      ${columns.status} TEXT NOT NULL DEFAULT '${contentStatus.DRAFT}',
      ${columns.message} TEXT NOT NULL DEFAULT '',
      ${columns.latitude} REAL NOT NULL DEFAULT 0,
      ${columns.longitude} REAL NOT NULL DEFAULT 0,
      ${columns.plusCode} TEXT NOT NULL DEFAULT '',
      ${columns.locationLabel} TEXT NOT NULL DEFAULT '',
      ${columns.markerType} TEXT NOT NULL DEFAULT 'default',
      ${columns.style} TEXT NOT NULL DEFAULT '',
      ${columns.hashtags} TEXT NOT NULL DEFAULT '[]',
      ${columns.multimedia} TEXT NOT NULL DEFAULT '{}',
      ${columns.createdAt} INTEGER NOT NULL,
      ${columns.updatedAt} INTEGER NOT NULL,
      ${columns.publishedAt} INTEGER DEFAULT NULL,
      ${columns.withdrawnAt} INTEGER DEFAULT NULL,
      ${columns.deletedAt} INTEGER DEFAULT NULL,
      CONSTRAINT fk_public_content_author
        FOREIGN KEY (${columns.authorAdminUserId}) REFERENCES ${adminUserTableName}(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
      CONSTRAINT fk_public_content_editor
        FOREIGN KEY (${columns.lastEditorAdminUserId}) REFERENCES ${adminUserTableName}(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
      CONSTRAINT fk_public_content_publisher
        FOREIGN KEY (${columns.publisherAdminUserId}) REFERENCES ${adminUserTableName}(id)
        ON UPDATE CASCADE ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_public_content_author
      ON ${tableName}(${columns.authorAdminUserId}, ${columns.updatedAt} DESC);
    CREATE INDEX IF NOT EXISTS idx_public_content_status
      ON ${tableName}(${columns.status}, ${columns.updatedAt} DESC);
    CREATE INDEX IF NOT EXISTS idx_public_content_published_uuid
      ON ${tableName}(${columns.publishedMessageUuid});
  `;

  db.exec(sql, (err) => {
    if (err) {
      throw err;
    }
  });

  db.all(`PRAGMA table_info(${tableName})`, [], (pragmaErr, rows) => {
    if (pragmaErr || !Array.isArray(rows)) {
      return;
    }

    const hasLocationLabelColumn = rows.some((row) => row?.name === columns.locationLabel);
    if (hasLocationLabelColumn) {
      return;
    }

    db.run(`
      ALTER TABLE ${tableName}
      ADD COLUMN ${columns.locationLabel} TEXT NOT NULL DEFAULT ''
    `, []);
  });
}

function create(db, payload, callback) {
  const now = Number.isFinite(payload?.createdAt) ? payload.createdAt : Date.now();
  const id = payload?.id || crypto.randomUUID();
  const sql = `
    INSERT INTO ${tableName} (
      ${columns.id},
      ${columns.authorAdminUserId},
      ${columns.lastEditorAdminUserId},
      ${columns.publisherAdminUserId},
      ${columns.publisherPublicUserId},
      ${columns.publishedMessageId},
      ${columns.publishedMessageUuid},
      ${columns.status},
      ${columns.message},
      ${columns.latitude},
      ${columns.longitude},
      ${columns.plusCode},
      ${columns.locationLabel},
      ${columns.markerType},
      ${columns.style},
      ${columns.hashtags},
      ${columns.multimedia},
      ${columns.createdAt},
      ${columns.updatedAt},
      ${columns.publishedAt},
      ${columns.withdrawnAt},
      ${columns.deletedAt}
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    id,
    payload.authorAdminUserId,
    payload.lastEditorAdminUserId ?? payload.authorAdminUserId,
    payload.publisherAdminUserId ?? null,
    payload.publisherPublicUserId ?? null,
    payload.publishedMessageId ?? null,
    payload.publishedMessageUuid ?? null,
    payload.status ?? contentStatus.DRAFT,
    payload.message ?? '',
    Number(payload.latitude ?? 0),
    Number(payload.longitude ?? 0),
    payload.plusCode ?? '',
    payload.locationLabel ?? '',
    payload.markerType ?? 'default',
    payload.style ?? '',
    payload.hashtags ?? '[]',
    payload.multimedia ?? '{}',
    now,
    Number.isFinite(payload?.updatedAt) ? payload.updatedAt : now,
    payload.publishedAt ?? null,
    payload.withdrawnAt ?? null,
    payload.deletedAt ?? null
  ];

  db.run(sql, params, function (err) {
    if (err) {
      return callback(err);
    }
    callback(null, { id });
  });
}

function getById(db, id, callback) {
  const sql = `
    SELECT
      c.*,
      author.username AS authorUsername,
      editor.username AS lastEditorUsername,
      publisher.username AS publisherUsername
    FROM ${tableName} c
    INNER JOIN ${adminUserTableName} author ON author.id = c.${columns.authorAdminUserId}
    LEFT JOIN ${adminUserTableName} editor ON editor.id = c.${columns.lastEditorAdminUserId}
    LEFT JOIN ${adminUserTableName} publisher ON publisher.id = c.${columns.publisherAdminUserId}
    WHERE c.${columns.id} = ?
    LIMIT 1
  `;

  db.get(sql, [id], (err, row) => {
    if (err) {
      return callback(err);
    }
    callback(null, row || null);
  });
}

function list(db, filters, callback) {
  const where = [];
  const params = [];

  if (filters?.authorAdminUserId) {
    where.push(`c.${columns.authorAdminUserId} = ?`);
    params.push(filters.authorAdminUserId);
  }

  if (filters?.status) {
    where.push(`c.${columns.status} = ?`);
    params.push(filters.status);
  } else if (!filters?.includeDeleted) {
    where.push(`c.${columns.status} <> ?`);
    params.push(contentStatus.DELETED);
  }

  if (filters?.query) {
    where.push(`(
      LOWER(c.${columns.message}) LIKE ?
      OR LOWER(author.username) LIKE ?
      OR LOWER(c.${columns.plusCode}) LIKE ?
      OR LOWER(c.${columns.locationLabel}) LIKE ?
    )`);
    const query = `%${String(filters.query).trim().toLowerCase()}%`;
    params.push(query, query, query, query);
  }

  let sql = `
    SELECT
      c.*,
      author.username AS authorUsername,
      editor.username AS lastEditorUsername,
      publisher.username AS publisherUsername
    FROM ${tableName} c
    INNER JOIN ${adminUserTableName} author ON author.id = c.${columns.authorAdminUserId}
    LEFT JOIN ${adminUserTableName} editor ON editor.id = c.${columns.lastEditorAdminUserId}
    LEFT JOIN ${adminUserTableName} publisher ON publisher.id = c.${columns.publisherAdminUserId}
  `;

  if (where.length > 0) {
    sql += ` WHERE ${where.join(' AND ')}`;
  }

  sql += ` ORDER BY c.${columns.updatedAt} DESC`;

  const limit = Number.isFinite(filters?.limit) ? Math.min(Math.max(Math.floor(filters.limit), 1), 500) : 100;
  const offset = Number.isFinite(filters?.offset) ? Math.max(Math.floor(filters.offset), 0) : 0;
  sql += ` LIMIT ${limit} OFFSET ${offset}`;

  db.all(sql, params, (err, rows) => {
    if (err) {
      return callback(err);
    }
    callback(null, rows || []);
  });
}

function update(db, id, fields, callback) {
  const updates = [];
  const params = [];

  const allowedKeys = [
    columns.message,
    columns.latitude,
    columns.longitude,
    columns.plusCode,
    columns.locationLabel,
    columns.markerType,
    columns.style,
    columns.hashtags,
    columns.multimedia,
    columns.lastEditorAdminUserId,
    columns.publisherAdminUserId,
    columns.publisherPublicUserId,
    columns.publishedMessageId,
    columns.publishedMessageUuid,
    columns.status,
    columns.publishedAt,
    columns.withdrawnAt,
    columns.deletedAt
  ];

  for (const key of allowedKeys) {
    if (!Object.prototype.hasOwnProperty.call(fields || {}, key)) {
      continue;
    }
    updates.push(`${key} = ?`);
    params.push(fields[key]);
  }

  const updatedAt = Number.isFinite(fields?.updatedAt) ? fields.updatedAt : Date.now();
  updates.push(`${columns.updatedAt} = ?`);
  params.push(updatedAt);

  params.push(id);

  const sql = `UPDATE ${tableName} SET ${updates.join(', ')} WHERE ${columns.id} = ?`;
  db.run(sql, params, function (err) {
    if (err) {
      return callback(err);
    }
    callback(null, this?.changes > 0);
  });
}

module.exports = {
  tableName,
  columns,
  contentStatus,
  init,
  create,
  getById,
  list,
  update
};
