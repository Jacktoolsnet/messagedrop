// db/tableDsaSignal.js
const tableName = 'tableDsaSignal';

const columnId = 'id';                                   // TEXT PK (uuid)
const columnContentId = 'contentId';                     // TEXT NOT NULL
const columnContentUrl = 'contentUrl';                   // TEXT NULL
const columnCategory = 'category';                       // TEXT NULL (frei, z. B. 'hate', 'privacy')
const columnReasonText = 'reasonText';                   // TEXT NULL
const columnReportedContentType = 'reportedContentType'; // TEXT NOT NULL
const columnReportedContent = 'reportedContent';         // TEXT NOT NULL (JSON-String)
const columnCreatedAt = 'createdAt';                     // INTEGER NOT NULL (unix ms)
const columnPublicToken = 'publicToken';                 // TEXT NULL (Status-Token)
const columnPublicTokenCreatedAt = 'publicTokenCreatedAt'; // INTEGER NULL
const columnDismissedAt = 'dismissedAt';                  // INTEGER NULL (soft delete)

// === INIT ===
const init = function (db) {
    try {
        const sql = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        ${columnId} TEXT PRIMARY KEY NOT NULL,
        ${columnContentId} TEXT NOT NULL,
        ${columnContentUrl} TEXT DEFAULT NULL,
        ${columnCategory} TEXT DEFAULT NULL,
        ${columnReasonText} TEXT DEFAULT NULL,
        ${columnReportedContentType} TEXT NOT NULL,
        ${columnReportedContent} TEXT NOT NULL,
        ${columnCreatedAt} INTEGER NOT NULL,
        ${columnPublicToken} TEXT DEFAULT NULL,
        ${columnPublicTokenCreatedAt} INTEGER DEFAULT NULL,
        ${columnDismissedAt} INTEGER DEFAULT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_dsa_signal_contentId
        ON ${tableName}(${columnContentId});
      CREATE INDEX IF NOT EXISTS idx_dsa_signal_createdAt_desc
        ON ${tableName}(${columnCreatedAt} DESC);
      CREATE INDEX IF NOT EXISTS idx_dsa_signal_reported_type
        ON ${tableName}(${columnReportedContentType});
      CREATE INDEX IF NOT EXISTS idx_dsa_signal_category
        ON ${tableName}(${columnCategory});
    `;
        db.serialize(() => {
            db.exec(sql, (err) => {
                if (err) throw err;
            });

            db.exec(`
          ALTER TABLE ${tableName} ADD COLUMN ${columnPublicToken} TEXT DEFAULT NULL;
        `, (err) => {
                if (err && !/duplicate column/.test(err.message)) throw err;
            });

            db.exec(`
          ALTER TABLE ${tableName} ADD COLUMN ${columnPublicTokenCreatedAt} INTEGER DEFAULT NULL;
        `, (err) => {
                if (err && !/duplicate column/.test(err.message)) throw err;
            });

            db.exec(`
          ALTER TABLE ${tableName} ADD COLUMN ${columnDismissedAt} INTEGER DEFAULT NULL;
        `, (err) => {
                if (err && !/duplicate column/.test(err.message)) throw err;
            });
        });
    } catch (err) {
        throw err;
    }
};

/**
 * Insert a quick report signal.
 */
const create = function (
    db,
    id,
    contentId,
    contentUrl,
    category,
    reasonText,
    reportedContentType,
    reportedContentJson,
    createdAt,
    publicToken,
    publicTokenCreatedAt,
    callBack
) {
    const stmt = `
    INSERT INTO ${tableName} (
      ${columnId},
      ${columnContentId},
      ${columnContentUrl},
      ${columnCategory},
      ${columnReasonText},
      ${columnReportedContentType},
      ${columnReportedContent},
      ${columnCreatedAt},
      ${columnPublicToken},
      ${columnPublicTokenCreatedAt}
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
    const params = [
        id,
        contentId,
        contentUrl,
        category,
        reasonText,
        reportedContentType,
        reportedContentJson,
        createdAt,
        publicToken,
        publicTokenCreatedAt
    ];
    db.run(stmt, params, function (err) {
        if (err) return callBack(err);
        callBack(null, { id });
    });
};

/** Get by id */
const getById = function (db, id, callBack) {
    const sql = `SELECT * FROM ${tableName} WHERE ${columnId} = ? LIMIT 1`;
    db.get(sql, [id], (err, row) => {
        if (err) return callBack(err);
        callBack(null, row);
    });
};

const getByPublicToken = function (db, token, callBack) {
    const sql = `SELECT * FROM ${tableName} WHERE ${columnPublicToken} = ? LIMIT 1`;
    db.get(sql, [token], (err, row) => {
        if (err) return callBack(err);
        callBack(null, row);
    });
};

/**
 * List signals (optional filters + pagination).
 * Supported filters:
 *  - contentId
 *  - reportedContentType
 *  - category
 *  - since (createdAt >= since)
 *  - q (LIKE over reasonText, contentId, reportedContent)
 *  - limit, offset
 */
const list = function (db, opts, callBack) {
    const where = [];
    const params = [];

    if (opts?.contentId) {
        where.push(`${columnContentId} = ?`);
        params.push(opts.contentId);
    }
    if (opts?.reportedContentType) {
        where.push(`${columnReportedContentType} = ?`);
        params.push(opts.reportedContentType);
    }
    if (opts?.category) {
        where.push(`${columnCategory} = ?`);
        params.push(opts.category);
    }
    if (Number.isFinite(opts?.since)) {
        where.push(`${columnCreatedAt} >= ?`);
        params.push(opts.since);
    }
    if (opts?.q) {
        const q = `%${opts.q}%`;
        where.push(`(${columnReasonText} LIKE ? OR ${columnContentId} LIKE ? OR ${columnReportedContent} LIKE ?)`);
        params.push(q, q, q);
    }

    let sql = `SELECT * FROM ${tableName}`;
    // Hide dismissed signals by default
    const baseWhere = [`${columnDismissedAt} IS NULL`];
    if (where.length) baseWhere.push(where.join(' AND '));
    sql += ` WHERE ${baseWhere.join(' AND ')}`;
    sql += ` ORDER BY ${columnCreatedAt} DESC`;

    const limit = Number.isFinite(opts?.limit) ? Math.max(1, opts.limit) : 100;
    const offset = Number.isFinite(opts?.offset) ? Math.max(0, opts.offset) : 0;
    sql += ` LIMIT ${limit} OFFSET ${offset}`;

    db.all(sql, params, (err, rows) => {
        if (err) return callBack(err);
        callBack(null, rows);
    });
};

/** Delete (hard) by id */
const remove = function (db, id, callBack) {
    const sql = `DELETE FROM ${tableName} WHERE ${columnId} = ?`;
    db.run(sql, [id], function (err) {
        if (err) return callBack(err);
        callBack(null, this.changes > 0);
    });
};

/** Soft-dismiss (mark as dismissed, keep row for status page) */
const dismiss = function (db, id, dismissedAt, callBack) {
    const sql = `UPDATE ${tableName} SET ${columnDismissedAt} = ? WHERE ${columnId} = ?`;
    db.run(sql, [dismissedAt, id], function (err) {
        if (err) return callBack(err);
        callBack(null, this.changes > 0);
    });
};

/** Stats */
const stats = function (db, callBack) {
    const activePredicate = `${columnDismissedAt} IS NULL`;
    const sqlTotal = `SELECT COUNT(*) AS total FROM ${tableName} WHERE ${activePredicate}`;
    const sqlByType = `
    SELECT ${columnReportedContentType} AS type, COUNT(*) AS cnt
    FROM ${tableName}
    WHERE ${activePredicate}
    GROUP BY ${columnReportedContentType}
  `;
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const sql24h = `SELECT COUNT(*) AS cnt FROM ${tableName} WHERE ${activePredicate} AND ${columnCreatedAt} >= ?`;

    db.get(sqlTotal, [], (e1, t) => {
        if (e1) return callBack(e1);
        db.all(sqlByType, [], (e2, rows) => {
            if (e2) return callBack(e2);
            const byType = {};
            for (const r of rows || []) byType[r.type || 'UNKNOWN'] = Number(r.cnt) || 0;
            db.get(sql24h, [since], (e3, r24) => {
                if (e3) return callBack(e3);
                callBack(null, {
                    total: Number(t?.total || 0),
                    last24h: Number(r24?.cnt || 0),
                    byType
                });
            });
        });
    });
};

module.exports = {
    tableName,
    columns: {
        id: columnId,
        contentId: columnContentId,
        contentUrl: columnContentUrl,
        category: columnCategory,
        reasonText: columnReasonText,
        reportedContentType: columnReportedContentType,
        reportedContent: columnReportedContent,
        createdAt: columnCreatedAt,
        publicToken: columnPublicToken,
        publicTokenCreatedAt: columnPublicTokenCreatedAt
    },
    init,
    create,
    getById,
    getByPublicToken,
    list,
    remove,
    dismiss,
    stats
};
