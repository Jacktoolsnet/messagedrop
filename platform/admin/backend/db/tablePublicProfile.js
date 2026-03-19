const crypto = require('crypto');

const tableName = 'tablePublicProfile';
const contentTableName = 'tablePublicContent';

const columns = {
  id: 'id',
  name: 'name',
  avatarImage: 'avatarImage',
  avatarAuthorName: 'avatarAuthorName',
  avatarAuthorUrl: 'avatarAuthorUrl',
  avatarUnsplashUrl: 'avatarUnsplashUrl',
  defaultStyle: 'defaultStyle',
  publicBackendUserId: 'publicBackendUserId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

function init(db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      ${columns.id} TEXT PRIMARY KEY NOT NULL,
      ${columns.name} TEXT NOT NULL,
      ${columns.avatarImage} TEXT NOT NULL DEFAULT '',
      ${columns.avatarAuthorName} TEXT NOT NULL DEFAULT '',
      ${columns.avatarAuthorUrl} TEXT NOT NULL DEFAULT '',
      ${columns.avatarUnsplashUrl} TEXT NOT NULL DEFAULT '',
      ${columns.defaultStyle} TEXT NOT NULL DEFAULT '',
      ${columns.publicBackendUserId} TEXT DEFAULT NULL,
      ${columns.createdAt} INTEGER NOT NULL,
      ${columns.updatedAt} INTEGER NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_public_profile_name_unique
      ON ${tableName}(${columns.name} COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_public_profile_updated_desc
      ON ${tableName}(${columns.updatedAt} DESC);
    CREATE INDEX IF NOT EXISTS idx_public_profile_public_backend
      ON ${tableName}(${columns.publicBackendUserId});
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

    const knownColumns = new Set(rows.map((row) => row?.name));
    if (!knownColumns.has(columns.avatarImage)) {
      db.run(`
        ALTER TABLE ${tableName}
        ADD COLUMN ${columns.avatarImage} TEXT NOT NULL DEFAULT ''
      `, []);
    }
    if (!knownColumns.has(columns.defaultStyle)) {
      db.run(`
        ALTER TABLE ${tableName}
        ADD COLUMN ${columns.defaultStyle} TEXT NOT NULL DEFAULT ''
      `, []);
    }
    if (!knownColumns.has(columns.avatarAuthorName)) {
      db.run(`
        ALTER TABLE ${tableName}
        ADD COLUMN ${columns.avatarAuthorName} TEXT NOT NULL DEFAULT ''
      `, []);
    }
    if (!knownColumns.has(columns.avatarAuthorUrl)) {
      db.run(`
        ALTER TABLE ${tableName}
        ADD COLUMN ${columns.avatarAuthorUrl} TEXT NOT NULL DEFAULT ''
      `, []);
    }
    if (!knownColumns.has(columns.avatarUnsplashUrl)) {
      db.run(`
        ALTER TABLE ${tableName}
        ADD COLUMN ${columns.avatarUnsplashUrl} TEXT NOT NULL DEFAULT ''
      `, []);
    }
    if (!knownColumns.has(columns.publicBackendUserId)) {
      db.run(`
        ALTER TABLE ${tableName}
        ADD COLUMN ${columns.publicBackendUserId} TEXT DEFAULT NULL
      `, []);
    }
    if (!knownColumns.has(columns.updatedAt)) {
      db.run(`
        ALTER TABLE ${tableName}
        ADD COLUMN ${columns.updatedAt} INTEGER NOT NULL DEFAULT 0
      `, []);
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
      ${columns.avatarImage},
      ${columns.avatarAuthorName},
      ${columns.avatarAuthorUrl},
      ${columns.avatarUnsplashUrl},
      ${columns.defaultStyle},
      ${columns.publicBackendUserId},
      ${columns.createdAt},
      ${columns.updatedAt}
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    id,
    payload?.name ?? '',
    payload?.avatarImage ?? '',
    payload?.avatarAuthorName ?? '',
    payload?.avatarAuthorUrl ?? '',
    payload?.avatarUnsplashUrl ?? '',
    payload?.defaultStyle ?? '',
    payload?.publicBackendUserId ?? null,
    now,
    Number.isFinite(payload?.updatedAt) ? payload.updatedAt : now
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
      p.*,
      COALESCE(COUNT(c.id), 0) AS contentCount
    FROM ${tableName} p
    LEFT JOIN ${contentTableName} c ON c.publicProfileId = p.${columns.id}
    WHERE p.${columns.id} = ?
    GROUP BY p.${columns.id}
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

  if (filters?.query) {
    where.push(`LOWER(p.${columns.name}) LIKE ?`);
    params.push(`%${String(filters.query).trim().toLowerCase()}%`);
  }

  let sql = `
    SELECT
      p.*,
      COALESCE(COUNT(c.id), 0) AS contentCount
    FROM ${tableName} p
    LEFT JOIN ${contentTableName} c ON c.publicProfileId = p.${columns.id}
  `;

  if (where.length > 0) {
    sql += ` WHERE ${where.join(' AND ')}`;
  }

  sql += `
    GROUP BY p.${columns.id}
    ORDER BY p.${columns.updatedAt} DESC, p.${columns.createdAt} DESC
  `;

  db.all(sql, params, (err, rows) => {
    if (err) {
      return callback(err);
    }
    callback(null, rows || []);
  });
}

function countContent(db, profileId, callback) {
  const sql = `
    SELECT COUNT(*) AS total
    FROM ${contentTableName}
    WHERE publicProfileId = ?
  `;

  db.get(sql, [profileId], (err, row) => {
    if (err) {
      return callback(err);
    }
    callback(null, Number(row?.total ?? 0));
  });
}

function update(db, id, fields, callback) {
  const updates = [];
  const params = [];

  const allowedKeys = [
    columns.name,
    columns.avatarImage,
    columns.avatarAuthorName,
    columns.avatarAuthorUrl,
    columns.avatarUnsplashUrl,
    columns.defaultStyle,
    columns.publicBackendUserId
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

  const sql = `UPDATE ${tableName} SET ${updates.join(', ')} WHERE ${columns.id} = ?`;
  db.run(sql, params, function (err) {
    if (err) {
      return callback(err);
    }
    callback(null, this?.changes > 0);
  });
}

function deleteById(db, id, callback) {
  const sql = `DELETE FROM ${tableName} WHERE ${columns.id} = ?`;
  db.run(sql, [id], function (err) {
    if (err) {
      return callback(err);
    }
    callback(null, this?.changes > 0);
  });
}

module.exports = {
  tableName,
  columns,
  init,
  create,
  getById,
  list,
  countContent,
  update,
  deleteById
};
