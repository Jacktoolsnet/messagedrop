const tableName = 'tableDsaDecision';

// === Column Names ===
const columnId = 'id';                  // TEXT PK (uuid) -> extern erzeugt
const columnNoticeId = 'noticeId';      // TEXT NOT NULL, FK -> tableDsaNotice(id)
const columnOutcome = 'outcome';        // TEXT NOT NULL ('REMOVE' | 'DISABLE' | 'RESTRICT' | 'NO_ACTION' | 'DEMONETIZE' | 'ACCOUNT_ACTION')
const columnLegalBasis = 'legalBasis';  // TEXT NULL (z. B. Gesetz/Paragraph)
const columnTosBasis = 'tosBasis';      // TEXT NULL (z. B. AGB-Klausel)
const columnAutomated = 'automatedUsed';// INTEGER NOT NULL (0/1) – wurde KI/Automatisierung verwendet
const columnDecidedBy = 'decidedBy';    // TEXT NOT NULL (Admin/Moderator-ID oder System)
const columnDecidedAt = 'decidedAt';    // INTEGER NOT NULL (unix ms)
const columnStatement = 'statement';    // TEXT NULL (Statement of Reasons)

// === INIT: create table + indexes ===
const init = function (db) {
    try {
        const sql = `
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS ${tableName} (
        ${columnId} TEXT PRIMARY KEY NOT NULL,
        ${columnNoticeId} TEXT NOT NULL,
        ${columnOutcome} TEXT NOT NULL,
        ${columnLegalBasis} TEXT DEFAULT NULL,
        ${columnTosBasis} TEXT DEFAULT NULL,
        ${columnAutomated} INTEGER NOT NULL,
        ${columnDecidedBy} TEXT NOT NULL,
        ${columnDecidedAt} INTEGER NOT NULL,
        ${columnStatement} TEXT DEFAULT NULL,
        CONSTRAINT fk_${tableName}_notice
          FOREIGN KEY (${columnNoticeId})
          REFERENCES tableDsaNotice(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_dsa_decision_notice
        ON ${tableName}(${columnNoticeId});

      CREATE INDEX IF NOT EXISTS idx_dsa_decision_outcome
        ON ${tableName}(${columnOutcome});

      CREATE INDEX IF NOT EXISTS idx_dsa_decision_decidedAt_desc
        ON ${tableName}(${columnDecidedAt} DESC);
    `;
        db.exec(sql, (err) => {
            if (err) throw err;
        });
    } catch (err) {
        throw err;
    }
};

// ——— Helpers ———

/**
 * Decision anlegen (alle Felder explizit; Validierung in Route).
 * @param {import('sqlite3').Database} db
 * @param {string} id
 * @param {string} noticeId
 * @param {string} outcome
 * @param {string|null} legalBasis
 * @param {string|null} tosBasis
 * @param {number} automatedUsed
 * @param {string} decidedBy
 * @param {number} decidedAt
 * @param {string|null} statement
 * @param {(err: any, row?: { id: string }) => void} callBack
 */
const create = function (
    db,
    id,
    noticeId,
    outcome,
    legalBasis,
    tosBasis,
    automatedUsed,
    decidedBy,
    decidedAt,
    statement,
    callBack
) {
    const stmt = `
    INSERT INTO ${tableName} (
      ${columnId},
      ${columnNoticeId},
      ${columnOutcome},
      ${columnLegalBasis},
      ${columnTosBasis},
      ${columnAutomated},
      ${columnDecidedBy},
      ${columnDecidedAt},
      ${columnStatement}
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

    const params = [
        id,
        noticeId,
        outcome,
        legalBasis,
        tosBasis,
        automatedUsed,
        decidedBy,
        decidedAt,
        statement
    ];

    db.run(stmt, params, function (err) {
        if (err) return callBack(err);
        callBack(null, { id });
    });
};

/**
 * Entscheidung per NoticeId abrufen (1:1 Beziehung).
 * @param {import('sqlite3').Database} db
 * @param {string} noticeId
 * @param {(err: any, row?: any) => void} callBack
 */
const getByNoticeId = function (db, noticeId, callBack) {
    const sql = `SELECT * FROM ${tableName} WHERE ${columnNoticeId} = ? ORDER BY ${columnDecidedAt} DESC LIMIT 1`;
    db.get(sql, [noticeId], (err, row) => {
        if (err) return callBack(err);
        callBack(null, row);
    });
};

/**
 * Entscheidung per ID abrufen.
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
 * Entscheidungen listen (z. B. für Monitoring).
 * @param {import('sqlite3').Database} db
 * @param {{
 *  outcome?: string,
 *  limit?: number,
 *  offset?: number
 * }} opts
 * @param {(err: any, rows?: any[]) => void} callBack
 */
const list = function (db, opts, callBack) {
    const where = [];
    const params = [];

    if (opts?.outcome) {
        where.push(`${columnOutcome} = ?`);
        params.push(opts.outcome);
    }

    let sql = `SELECT * FROM ${tableName}`;
    if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
    sql += ` ORDER BY ${columnDecidedAt} DESC`;

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
        outcome: columnOutcome,
        legalBasis: columnLegalBasis,
        tosBasis: columnTosBasis,
        automatedUsed: columnAutomated,
        decidedBy: columnDecidedBy,
        decidedAt: columnDecidedAt,
        statement: columnStatement
    },
    init,
    create,
    getByNoticeId,
    getById,
    list
};
