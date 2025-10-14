// Belege (Evidence) zu formalen DSA-Notices
// Speichert Referenzen wie Screenshot-URL, externe URL oder Hashes (z. B. Content-Hash).

const tableName = 'tableDsaEvidence';

// === Column Names ===
const columnId = 'id';                 // TEXT PK (uuid) -> extern erzeugt
const columnNoticeId = 'noticeId';     // TEXT NOT NULL, FK -> tableDsaNotice(id)
const columnType = 'type';             // TEXT NOT NULL: 'screenshot' | 'url' | 'hash' | 'file' | ...
const columnUrl = 'url';               // TEXT NULL (z. B. S3-Link, CDN-URL)
const columnHash = 'hash';             // TEXT NULL (z. B. SHA-256)
const columnFileName = 'fileName';     // TEXT NULL (Originaldateiname)
const columnFilePath = 'filePath';     // TEXT NULL (Serverpfad)
const columnAddedAt = 'addedAt';       // INTEGER NOT NULL (unix ms)

// === INIT: create table + indexes ===
const init = function (db) {
    try {
        const sql = `
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS ${tableName} (
        ${columnId} TEXT PRIMARY KEY NOT NULL,
        ${columnNoticeId} TEXT NOT NULL,
        ${columnType} TEXT NOT NULL,
        ${columnUrl} TEXT DEFAULT NULL,
        ${columnHash} TEXT DEFAULT NULL,
        ${columnFileName} TEXT DEFAULT NULL,
        ${columnFilePath} TEXT DEFAULT NULL,
        ${columnAddedAt} INTEGER NOT NULL,
        CONSTRAINT fk_${tableName}_notice
          FOREIGN KEY (${columnNoticeId})
          REFERENCES tableDsaNotice(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_dsa_evidence_notice
        ON ${tableName}(${columnNoticeId});

      CREATE INDEX IF NOT EXISTS idx_dsa_evidence_addedAt_desc
        ON ${tableName}(${columnAddedAt} DESC);

      CREATE INDEX IF NOT EXISTS idx_dsa_evidence_type
        ON ${tableName}(${columnType});
    `;
        db.serialize(() => {
            db.exec(sql, (err) => {
                if (err) throw err;
            });

            // Backfill missing columns when table already existed
            db.exec(`
              ALTER TABLE ${tableName} ADD COLUMN ${columnFileName} TEXT DEFAULT NULL;
            `, (err) => {
                if (err && !/duplicate column/.test(err.message)) throw err;
            });

            db.exec(`
              ALTER TABLE ${tableName} ADD COLUMN ${columnFilePath} TEXT DEFAULT NULL;
            `, (err) => {
                if (err && !/duplicate column/.test(err.message)) throw err;
            });
        });
    } catch (err) {
        throw err;
    }
};

// ——— Helpers ———

/**
 * Evidence anlegen (alle Parameter explizit; Validierung erfolgt in der Route).
 * @param {import('sqlite3').Database} db
 * @param {string} id            // UUID (extern erzeugt)
 * @param {string} noticeId      // FK -> tableDsaNotice.id
 * @param {string} type          // 'screenshot' | 'url' | 'hash' | 'file' | ...
 * @param {string|null} url      // optional
 * @param {string|null} hash     // optional
 * @param {number} addedAt       // Unix ms
 * @param {(err: any, row?: { id: string }) => void} callBack
 */
const create = function (db, id, noticeId, type, url, hash, fileName, filePath, addedAt, callBack) {
    const stmt = `
    INSERT INTO ${tableName} (
      ${columnId},
      ${columnNoticeId},
      ${columnType},
      ${columnUrl},
      ${columnHash},
      ${columnFileName},
      ${columnFilePath},
      ${columnAddedAt}
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

    const params = [id, noticeId, type, url, hash, fileName, filePath, addedAt];

    db.run(stmt, params, function (err) {
        if (err) return callBack(err);
        callBack(null, { id });
    });
};

/**
 * Evidence per ID abrufen (Rohdaten).
 * @param {import('sqlite3').Database} db
 * @param {string} id
 * @param {(err: any, row?: any) => void} callBack
 */
const getById = function (db, id, callBack) {
    const sql = `SELECT * FROM ${tableName} WHERE ${columnId} = ? LIMIT 1`;
    db.get(sql, [id], (err, row) => {
        if (err) return callBack(err);
        callBack(null, row);
    });
};

/**
 * Evidence zu einer Notice listen (optional: Typ-Filter, Pagination).
 * @param {import('sqlite3').Database} db
 * @param {{
 *  noticeId: string,
 *  type?: string,
 *  limit?: number,
 *  offset?: number
 * }} opts
 * @param {(err: any, rows?: any[]) => void} callBack
 */
const listByNotice = function (db, opts, callBack) {
    const where = [`${columnNoticeId} = ?`];
    const params = [opts.noticeId];

    if (opts?.type) {
        where.push(`${columnType} = ?`);
        params.push(opts.type);
    }

    let sql = `SELECT * FROM ${tableName} WHERE ${where.join(' AND ')} ORDER BY ${columnAddedAt} DESC`;

    const limit = Number.isFinite(opts?.limit) ? opts.limit : 100;
    const offset = Number.isFinite(opts?.offset) ? opts.offset : 0;
    sql += ` LIMIT ${limit} OFFSET ${offset}`;

    db.all(sql, params, (err, rows) => {
        if (err) return callBack(err);
        callBack(null, rows);
    });
};

module.exports = {
    tableName,
    columns: {
        id: columnId,
        noticeId: columnNoticeId,
        type: columnType,
        url: columnUrl,
        hash: columnHash,
        fileName: columnFileName,
        filePath: columnFilePath,
        addedAt: columnAddedAt
    },
    init,
    create,
    getById,
    listByNotice
};
