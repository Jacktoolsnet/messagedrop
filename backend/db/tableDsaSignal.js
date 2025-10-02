const tableName = 'tableDsaSignal';

const columnId = 'id';                                   // TEXT PK (uuid) -> wird extern erzeugt
const columnContentId = 'contentId';                     // TEXT NOT NULL (z. B. message.uuid)
const columnContentUrl = 'contentUrl';                   // TEXT NULL
const columnCategory = 'category';                       // TEXT NULL (frei, z. B. 'hate', 'privacy')
const columnReasonText = 'reasonText';                   // TEXT NULL
const columnReportedContentType = 'reportedContentType'; // TEXT NOT NULL (z. B. 'public message')
const columnReportedContent = 'reportedContent';         // TEXT NOT NULL (JSON-String der Originalnachricht)
const columnCreatedAt = 'createdAt';                     // INTEGER NOT NULL (unix ms)

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
        ${columnReportedContentType} TEXT NOT NULL,
        ${columnReportedContent} TEXT NOT NULL,
        ${columnCreatedAt} INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_dsa_signal_contentId
        ON ${tableName}(${columnContentId});

      CREATE INDEX IF NOT EXISTS idx_dsa_signal_createdAt_desc
        ON ${tableName}(${columnCreatedAt} DESC);

      CREATE INDEX IF NOT EXISTS idx_dsa_signal_reported_type
        ON ${tableName}(${columnReportedContentType});
    `;
        db.exec(sql, (err) => {
            if (err) throw err;
        });
    } catch (err) {
        throw err;
    }
};


/**
 * Insert a quick report signal.
 * Alle Felder werden explizit übergeben; Validierung erfolgt in der Route.
 * @param {import('sqlite3').Database} db
 * @param {string} id                             // UUID (extern erzeugt)
 * @param {string} contentId                      // ID des gemeldeten Inhalts
 * @param {string|null} contentUrl                // optionaler Permalink/Deep-Link
 * @param {string|null} category                  // optional (z. B. 'hate', 'privacy')
 * @param {string|null} reasonText                // optionaler Freitext
 * @param {string} reportedContentType            // z. B. 'public message'
 * @param {string} reportedContentJson            // JSON-String der Originalnachricht (bereits serialisiert)
 * @param {number} createdAt                      // Unix ms
 * @param {(err: any, row?: { id: string }) => void} callBack
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
      ${columnCreatedAt}
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

    const params = [
        id,
        contentId,
        contentUrl,
        category,
        reasonText,
        reportedContentType,
        reportedContentJson,
        createdAt
    ];

    db.run(stmt, params, function (err) {
        if (err) return callBack(err);
        callBack(null, { id });
    });
};

/**
 * Get a signal by id (Rohdaten, reportedContent bleibt JSON-String).
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
 * List signals (optional filter + pagination). Rohdaten zurückgeben.
 * @param {import('sqlite3').Database} db
 * @param {{
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
        createdAt: columnCreatedAt
    },
    init,
    create,
    getById,
    list
};