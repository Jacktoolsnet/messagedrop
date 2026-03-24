const crypto = require('crypto');
const { DEFAULT_DSA_TEXT_BLOCKS, TEXT_BLOCK_TYPES } = require('./dsaTextBlockDefaults');

const tableName = 'tableDsaTextBlock';

const columns = {
    id: 'id',
    key: 'key',
    type: 'type',
    labelDe: 'labelDe',
    labelEn: 'labelEn',
    descriptionDe: 'descriptionDe',
    descriptionEn: 'descriptionEn',
    contentDe: 'contentDe',
    contentEn: 'contentEn',
    decisionOutcomes: 'decisionOutcomes',
    sortOrder: 'sortOrder',
    isActive: 'isActive',
    translatedAt: 'translatedAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
};

function init(db) {
    const sql = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        ${columns.id} TEXT PRIMARY KEY NOT NULL,
        ${columns.key} TEXT NOT NULL,
        ${columns.type} TEXT NOT NULL,
        ${columns.labelDe} TEXT NOT NULL DEFAULT '',
        ${columns.labelEn} TEXT NOT NULL DEFAULT '',
        ${columns.descriptionDe} TEXT NOT NULL DEFAULT '',
        ${columns.descriptionEn} TEXT NOT NULL DEFAULT '',
        ${columns.contentDe} TEXT NOT NULL DEFAULT '',
        ${columns.contentEn} TEXT NOT NULL DEFAULT '',
        ${columns.decisionOutcomes} TEXT NOT NULL DEFAULT '[]',
        ${columns.sortOrder} INTEGER NOT NULL DEFAULT 0,
        ${columns.isActive} INTEGER NOT NULL DEFAULT 1,
        ${columns.translatedAt} INTEGER DEFAULT NULL,
        ${columns.createdAt} INTEGER NOT NULL,
        ${columns.updatedAt} INTEGER NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_dsa_text_block_key_unique
        ON ${tableName}(${columns.key});

      CREATE INDEX IF NOT EXISTS idx_dsa_text_block_type_sort
        ON ${tableName}(${columns.type}, ${columns.sortOrder} ASC, ${columns.updatedAt} DESC);

      CREATE INDEX IF NOT EXISTS idx_dsa_text_block_active
        ON ${tableName}(${columns.isActive});
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
        if (!knownColumns.has(columns.decisionOutcomes)) {
            db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columns.decisionOutcomes} TEXT NOT NULL DEFAULT '[]'`, []);
        }
        if (!knownColumns.has(columns.translatedAt)) {
            db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columns.translatedAt} INTEGER DEFAULT NULL`, []);
        }
    });

    seedDefaults(db);
}

function seedDefaults(db) {
    db.get(`SELECT COUNT(*) AS total FROM ${tableName}`, [], (countErr, row) => {
        if (countErr) {
            return;
        }
        if (Number(row?.total || 0) > 0) {
            return;
        }

        const now = Date.now();
        DEFAULT_DSA_TEXT_BLOCKS.forEach((entry) => {
            const params = [
                crypto.randomUUID(),
                entry.key,
                entry.type,
                entry.labelDe || '',
                entry.labelEn || '',
                entry.descriptionDe || '',
                entry.descriptionEn || '',
                entry.contentDe || '',
                entry.contentEn || '',
                JSON.stringify(Array.isArray(entry.decisionOutcomes) ? entry.decisionOutcomes : []),
                Number.isFinite(entry.sortOrder) ? entry.sortOrder : 0,
                entry.isActive ? 1 : 0,
                now,
                now,
                now
            ];
            db.run(`
              INSERT INTO ${tableName} (
                ${columns.id},
                ${columns.key},
                ${columns.type},
                ${columns.labelDe},
                ${columns.labelEn},
                ${columns.descriptionDe},
                ${columns.descriptionEn},
                ${columns.contentDe},
                ${columns.contentEn},
                ${columns.decisionOutcomes},
                ${columns.sortOrder},
                ${columns.isActive},
                ${columns.translatedAt},
                ${columns.createdAt},
                ${columns.updatedAt}
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, params, () => { });
        });
    });
}

function create(db, payload, callback) {
    const now = Number.isFinite(payload?.createdAt) ? payload.createdAt : Date.now();
    const id = payload?.id || crypto.randomUUID();
    const params = [
        id,
        payload?.key,
        payload?.type,
        payload?.labelDe ?? '',
        payload?.labelEn ?? '',
        payload?.descriptionDe ?? '',
        payload?.descriptionEn ?? '',
        payload?.contentDe ?? '',
        payload?.contentEn ?? '',
        JSON.stringify(Array.isArray(payload?.decisionOutcomes) ? payload.decisionOutcomes : []),
        Number.isFinite(payload?.sortOrder) ? payload.sortOrder : 0,
        payload?.isActive ? 1 : 0,
        Number.isFinite(payload?.translatedAt) ? payload.translatedAt : null,
        now,
        Number.isFinite(payload?.updatedAt) ? payload.updatedAt : now
    ];

    db.run(`
      INSERT INTO ${tableName} (
        ${columns.id},
        ${columns.key},
        ${columns.type},
        ${columns.labelDe},
        ${columns.labelEn},
        ${columns.descriptionDe},
        ${columns.descriptionEn},
        ${columns.contentDe},
        ${columns.contentEn},
        ${columns.decisionOutcomes},
        ${columns.sortOrder},
        ${columns.isActive},
        ${columns.translatedAt},
        ${columns.createdAt},
        ${columns.updatedAt}
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, params, function (err) {
        if (err) {
            return callback(err);
        }
        callback(null, { id });
    });
}

function getById(db, id, callback) {
    db.get(`SELECT * FROM ${tableName} WHERE ${columns.id} = ? LIMIT 1`, [id], (err, row) => {
        if (err) {
            return callback(err);
        }
        callback(null, row || null);
    });
}

function getByKey(db, key, callback) {
    db.get(`SELECT * FROM ${tableName} WHERE ${columns.key} = ? LIMIT 1`, [key], (err, row) => {
        if (err) {
            return callback(err);
        }
        callback(null, row || null);
    });
}

function list(db, filters, callback) {
    const where = [];
    const params = [];

    if (filters?.type) {
        where.push(`${columns.type} = ?`);
        params.push(filters.type);
    }

    if (typeof filters?.activeOnly === 'boolean') {
        where.push(`${columns.isActive} = ?`);
        params.push(filters.activeOnly ? 1 : 0);
    }

    if (filters?.query) {
        const q = `%${String(filters.query).trim().toLowerCase()}%`;
        where.push(`(
            LOWER(${columns.labelDe}) LIKE ?
            OR LOWER(${columns.labelEn}) LIKE ?
            OR LOWER(${columns.descriptionDe}) LIKE ?
            OR LOWER(${columns.descriptionEn}) LIKE ?
            OR LOWER(${columns.contentDe}) LIKE ?
            OR LOWER(${columns.contentEn}) LIKE ?
            OR LOWER(${columns.key}) LIKE ?
        )`);
        params.push(q, q, q, q, q, q, q);
    }

    let sql = `SELECT * FROM ${tableName}`;
    if (where.length > 0) {
        sql += ` WHERE ${where.join(' AND ')}`;
    }
    sql += ` ORDER BY ${columns.type} ASC, ${columns.sortOrder} ASC, ${columns.updatedAt} DESC`;

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
        columns.key,
        columns.type,
        columns.labelDe,
        columns.labelEn,
        columns.descriptionDe,
        columns.descriptionEn,
        columns.contentDe,
        columns.contentEn,
        columns.decisionOutcomes,
        columns.sortOrder,
        columns.isActive,
        columns.translatedAt
    ];

    allowedKeys.forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(fields || {}, key)) {
            return;
        }
        updates.push(`${key} = ?`);
        params.push(fields[key]);
    });

    if (updates.length === 0) {
        return process.nextTick(() => callback(null, false));
    }

    updates.push(`${columns.updatedAt} = ?`);
    params.push(Number.isFinite(fields?.updatedAt) ? fields.updatedAt : Date.now());
    params.push(id);

    db.run(`UPDATE ${tableName} SET ${updates.join(', ')} WHERE ${columns.id} = ?`, params, function (err) {
        if (err) {
            return callback(err);
        }
        callback(null, this?.changes > 0);
    });
}

function deleteById(db, id, callback) {
    db.run(`DELETE FROM ${tableName} WHERE ${columns.id} = ?`, [id], function (err) {
        if (err) {
            return callback(err);
        }
        callback(null, this?.changes > 0);
    });
}

module.exports = {
    tableName,
    columns,
    textBlockTypes: TEXT_BLOCK_TYPES,
    init,
    create,
    getById,
    getByKey,
    list,
    update,
    deleteById
};
