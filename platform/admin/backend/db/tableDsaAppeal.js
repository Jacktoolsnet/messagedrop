const tableName = 'tableDsaAppeal';

// === Column Names ===
const columnId = 'id';                 // TEXT PK (uuid) -> extern erzeugt
const columnDecisionId = 'decisionId'; // TEXT NOT NULL, FK -> tableDsaDecision(id)
const columnFiledBy = 'filedBy';       // TEXT NOT NULL (User-ID/Email/Name)
const columnFiledAt = 'filedAt';       // INTEGER NOT NULL (unix ms)
const columnArguments = 'arguments';   // TEXT NOT NULL (Begründung)
const columnOutcome = 'outcome';       // TEXT NULL ('UPHELD' | 'REVISED' | 'PARTIAL' | 'WITHDRAWN' | ...)
const columnResolvedAt = 'resolvedAt'; // INTEGER NULL (unix ms)
const columnReviewer = 'reviewer';     // TEXT NULL (Reviewer-Identität)

// === INIT: create table + indexes ===
const init = function (db) {
    try {
        const sql = `
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS ${tableName} (
        ${columnId} TEXT PRIMARY KEY NOT NULL,
        ${columnDecisionId} TEXT NOT NULL,
        ${columnFiledBy} TEXT NOT NULL,
        ${columnFiledAt} INTEGER NOT NULL,
        ${columnArguments} TEXT NOT NULL,
        ${columnOutcome} TEXT DEFAULT NULL,
        ${columnResolvedAt} INTEGER DEFAULT NULL,
        ${columnReviewer} TEXT DEFAULT NULL,
        CONSTRAINT fk_${tableName}_decision
          FOREIGN KEY (${columnDecisionId})
          REFERENCES tableDsaDecision(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_dsa_appeal_decision
        ON ${tableName}(${columnDecisionId});

      CREATE INDEX IF NOT EXISTS idx_dsa_appeal_filedAt_desc
        ON ${tableName}(${columnFiledAt} DESC);

      CREATE INDEX IF NOT EXISTS idx_dsa_appeal_outcome
        ON ${tableName}(${columnOutcome});
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
 * Appeal anlegen.
 * @param {import('sqlite3').Database} db
 * @param {string} id              // UUID (extern erzeugt)
 * @param {string} decisionId      // FK -> tableDsaDecision.id
 * @param {string} filedBy         // Wer die Beschwerde eingereicht hat
 * @param {number} filedAt         // Unix ms
 * @param {string} argsText        // Beschwerdebegründung
 * @param {string|null} outcome    // optional ('UPHELD' | 'REVISED' | 'PARTIAL' | 'WITHDRAWN' | ...)
 * @param {number|null} resolvedAt // optional Unix ms
 * @param {string|null} reviewer   // optional
 * @param {(err: any, row?: { id: string }) => void} callBack
 */
const create = function (
    db,
    id,
    decisionId,
    filedBy,
    filedAt,
    argsText,
    outcome,
    resolvedAt,
    reviewer,
    callBack
) {
    const stmt = `
    INSERT INTO ${tableName} (
      ${columnId},
      ${columnDecisionId},
      ${columnFiledBy},
      ${columnFiledAt},
      ${columnArguments},
      ${columnOutcome},
      ${columnResolvedAt},
      ${columnReviewer}
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

    const params = [
        id,
        decisionId,
        filedBy,
        filedAt,
        argsText,
        outcome,
        resolvedAt,
        reviewer
    ];

    db.run(stmt, params, function (err) {
        if (err) return callBack(err);
        callBack(null, { id });
    });
};

/**
 * Appeal per ID abrufen (Rohdaten).
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
 * Appeals zu einer Decision listen (optional: Outcome-Filter, Pagination).
 * @param {import('sqlite3').Database} db
 * @param {{
 *  decisionId: string,
 *  outcome?: string,
 *  limit?: number,
 *  offset?: number
 * }} opts
 * @param {(err: any, rows?: any[]) => void} callBack
 */
const listByDecision = function (db, opts, callBack) {
    const where = [`${columnDecisionId} = ?`];
    const params = [opts.decisionId];

    if (opts?.outcome) {
        where.push(`${columnOutcome} = ?`);
        params.push(opts.outcome);
    }

    let sql = `SELECT * FROM ${tableName} WHERE ${where.join(' AND ')} ORDER BY ${columnFiledAt} DESC`;

    const limit = Number.isFinite(opts?.limit) ? opts.limit : 100;
    const offset = Number.isFinite(opts?.offset) ? opts.offset : 0;
    sql += ` LIMIT ${limit} OFFSET ${offset}`;

    db.all(sql, params, (err, rows) => {
        if (err) return callBack(err);
        callBack(null, rows);
    });
};

/**
 * Outcome/Reviewer/ResolvedAt aktualisieren (z. B. nach Prüfung).
 * @param {import('sqlite3').Database} db
 * @param {string} id
 * @param {string|null} outcome
 * @param {number|null} resolvedAt
 * @param {string|null} reviewer
 * @param {(err: any, ok?: boolean) => void} callBack
 */
const updateResolution = function (db, id, outcome, resolvedAt, reviewer, callBack) {
    const sql = `
    UPDATE ${tableName}
       SET ${columnOutcome} = ?, ${columnResolvedAt} = ?, ${columnReviewer} = ?
     WHERE ${columnId} = ?
  `;
    db.run(sql, [outcome, resolvedAt, reviewer, id], function (err) {
        if (err) return callBack(err);
        callBack(null, this.changes > 0);
    });
};

module.exports = {
    tableName,
    columns: {
        id: columnId,
        decisionId: columnDecisionId,
        filedBy: columnFiledBy,
        filedAt: columnFiledAt,
        arguments: columnArguments,
        outcome: columnOutcome,
        resolvedAt: columnResolvedAt,
        reviewer: columnReviewer
    },
    init,
    create,
    getById,
    listByDecision,
    updateResolution
};