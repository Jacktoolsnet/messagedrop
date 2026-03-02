const tableName = 'tableDsaNotice';

// === Column Names ===
const columnId = 'id';                                   // TEXT PK (uuid) -> extern erzeugt
const columnContentId = 'contentId';                     // TEXT NOT NULL (z. B. message.uuid)
const columnContentUrl = 'contentUrl';                   // TEXT NULL (SPA/Permalink optional)
const columnCategory = 'category';                       // TEXT NULL
const columnReasonText = 'reasonText';                   // TEXT NULL
const columnReporterEmail = 'reporterEmail';             // TEXT NULL
const columnReporterName = 'reporterName';               // TEXT NULL
const columnTruthAffirmation = 'truthAffirmation';       // INTEGER NULL (0/1)
const columnReportedContentType = 'reportedContentType'; // TEXT NOT NULL (z. B. 'public message')
const columnReportedContent = 'reportedContent';         // TEXT NOT NULL (JSON-String der Originalnachricht)
const columnStatus = 'status';                           // TEXT NOT NULL
const columnCreatedAt = 'createdAt';                     // INTEGER NOT NULL (unix ms)
const columnUpdatedAt = 'updatedAt';                     // INTEGER NOT NULL (unix ms)
const columnPublicToken = 'publicToken';                 // TEXT NULL (Status-Token)
const columnPublicTokenCreatedAt = 'publicTokenCreatedAt'; // INTEGER NULL

// === INIT: create table + indexes ===
const init = function (db) {
    try {
        const sql = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        ${columnId} TEXT PRIMARY KEY NOT NULL,
        ${columnContentId} TEXT NOT NULL,
        ${columnContentUrl} TEXT DEFAULT NULL,
        ${columnCategory} TEXT DEFAULT NULL,
        ${columnReasonText} TEXT DEFAULT NULL,
        ${columnReporterEmail} TEXT DEFAULT NULL,
        ${columnReporterName} TEXT DEFAULT NULL,
        ${columnTruthAffirmation} INTEGER DEFAULT NULL,   -- 0/1, optional
        ${columnReportedContentType} TEXT NOT NULL,
        ${columnReportedContent} TEXT NOT NULL,
        ${columnStatus} TEXT NOT NULL,                    -- 'RECEIVED' | 'UNDER_REVIEW' | 'DECIDED' | ...
        ${columnCreatedAt} INTEGER NOT NULL,
        ${columnUpdatedAt} INTEGER NOT NULL,
        ${columnPublicToken} TEXT DEFAULT NULL,
        ${columnPublicTokenCreatedAt} INTEGER DEFAULT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_dsa_notice_contentId
        ON ${tableName}(${columnContentId});

      CREATE INDEX IF NOT EXISTS idx_dsa_notice_status_created
        ON ${tableName}(${columnStatus}, ${columnCreatedAt} DESC);

      CREATE INDEX IF NOT EXISTS idx_dsa_notice_reported_type
        ON ${tableName}(${columnReportedContentType});

      CREATE INDEX IF NOT EXISTS idx_dsa_notice_updatedAt_desc
        ON ${tableName}(${columnUpdatedAt} DESC);
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
        });
    } catch (err) {
        throw err;
    }
};

// ——— Helpers ———

/**
 * Insert a formal DSA notice.
 * Alle Felder explizit übergeben; Validierung erfolgt in der Route.
 * @param {import('sqlite3').Database} db
 * @param {string} id                              // UUID (extern erzeugt)
 * @param {string} contentId                       // ID des gemeldeten Inhalts
 * @param {string|null} contentUrl                 // optionaler Permalink/Deep-Link
 * @param {string|null} category                   // optional
 * @param {string|null} reasonText                 // optional
 * @param {string|null} reporterEmail              // optional
 * @param {string|null} reporterName               // optional
 * @param {number|null} truthAffirmation           // optional 0/1
 * @param {string} reportedContentType             // z. B. 'public message'
 * @param {string} reportedContentJson             // JSON-String der Originalnachricht (bereits serialisiert)
 * @param {string} status                          // z. B. 'RECEIVED'
 * @param {number} createdAt                       // Unix ms
 * @param {number} updatedAt                       // Unix ms
 * @param {(err: any, row?: { id: string }) => void} callBack
 */
const create = function (
    db,
    id,
    contentId,
    contentUrl,
    category,
    reasonText,
    reporterEmail,
    reporterName,
    truthAffirmation,
    reportedContentType,
    reportedContentJson,
    status,
    createdAt,
    updatedAt,
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
      ${columnReporterEmail},
      ${columnReporterName},
      ${columnTruthAffirmation},
      ${columnReportedContentType},
      ${columnReportedContent},
      ${columnStatus},
      ${columnCreatedAt},
      ${columnUpdatedAt},
      ${columnPublicToken},
      ${columnPublicTokenCreatedAt}
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

    const params = [
        id,
        contentId,
        contentUrl,
        category,
        reasonText,
        reporterEmail,
        reporterName,
        truthAffirmation,
        reportedContentType,
        reportedContentJson,
        status,
        createdAt,
        updatedAt,
        publicToken,
        publicTokenCreatedAt
    ];

    db.run(stmt, params, function (err) {
        if (err) return callBack(err);
        callBack(null, { id });
    });
};

/**
 * Get a notice by id (Rohdaten, reportedContent bleibt JSON-String).
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

const getByPublicToken = function (db, token, callBack) {
    const sql = `SELECT * FROM ${tableName} WHERE ${columnPublicToken} = ? LIMIT 1`;
    db.get(sql, [token], (err, row) => {
        if (err) return callBack(err);
        callBack(null, row);
    });
};

/**
 * List notices (optional filter + pagination). Rohdaten zurückgeben.
 * @param {import('sqlite3').Database} db
 * @param {{
 *  status?: string|string[],
 *  contentId?: string,
 *  reportedContentType?: string,
 *  limit?: number,
 *  offset?: number
 * }} [opts]
 * @param {(err: any, rows?: any[]) => void} callBack
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

    if (opts?.status) {
        const statuses = Array.isArray(opts.status) ? opts.status : [opts.status];
        if (statuses.length === 1) {
            where.push(`${columnStatus} = ?`);
            params.push(statuses[0]);
        } else if (statuses.length > 1) {
            where.push(`${columnStatus} IN (${statuses.map(() => '?').join(',')})`);
            params.push(...statuses);
        }
    }

    let sql = `SELECT * FROM ${tableName}`;
    if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
    sql += ` ORDER BY ${columnCreatedAt} DESC`;

    const limit = Number.isFinite(opts?.limit) ? opts.limit : 100;
    const offset = Number.isFinite(opts?.offset) ? opts.offset : 0;
    sql += ` LIMIT ${limit} OFFSET ${offset}`;

    db.all(sql, params, (err, rows) => {
        if (err) return callBack(err);
        callBack(null, rows);
    });
};

/**
 * Status + updatedAt aktualisieren (minimaler Updater).
 * @param {import('sqlite3').Database} db
 * @param {string} id
 * @param {string} newStatus
 * @param {number} updatedAt
 * @param {(err: any, ok?: boolean) => void} callBack
 */
const updateStatus = function (db, id, newStatus, updatedAt, callBack) {
    const sql = `
    UPDATE ${tableName}
       SET ${columnStatus} = ?, ${columnUpdatedAt} = ?
     WHERE ${columnId} = ?
  `;
    db.run(sql, [newStatus, updatedAt, id], function (err) {
        if (err) return callBack(err);
        callBack(null, this.changes > 0);
    });
};

/**
 * Stats für Notices.
 * - total: Anzahl aller Notices
 * - open: Anzahl aller Notices mit status != 'DECIDED' (oder NULL)
 * - byStatus: Map { STATUS -> count }
 * @param {import('sqlite3').Database} db
 * @param {(err: any, result?: { total:number, open:number, byStatus: Record<string,number> }) => void} callBack
 */
const stats = function (db, callBack) {
    const sqlByStatus = `
    SELECT COALESCE(${columnStatus}, 'UNKNOWN') AS status, COUNT(*) AS cnt
    FROM ${tableName}
    GROUP BY COALESCE(${columnStatus}, 'UNKNOWN')
  `;
    const sqlTotals = `
    SELECT 
      COUNT(*) AS total,
      SUM(CASE WHEN ${columnStatus} IS NULL OR ${columnStatus} <> 'DECIDED' THEN 1 ELSE 0 END) AS open
    FROM ${tableName}
  `;
    db.all(sqlByStatus, [], (err, rows) => {
        if (err) return callBack(err);
        const byStatus = {};
        for (const r of rows || []) {
            byStatus[r.status] = Number(r.cnt) || 0;
        }
        db.get(sqlTotals, [], (err2, agg) => {
            if (err2) return callBack(err2);
            callBack(null, {
                total: Number(agg?.total || 0),
                open: Number(agg?.open || 0),
                byStatus
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
        reporterEmail: columnReporterEmail,
        reporterName: columnReporterName,
        truthAffirmation: columnTruthAffirmation,
        reportedContentType: columnReportedContentType,
        reportedContent: columnReportedContent,
        status: columnStatus,
        createdAt: columnCreatedAt,
        updatedAt: columnUpdatedAt,
        publicToken: columnPublicToken,
        publicTokenCreatedAt: columnPublicTokenCreatedAt
    },
    init,
    create,
    getById,
    getByPublicToken,
    list,
    updateStatus,
    stats
};
