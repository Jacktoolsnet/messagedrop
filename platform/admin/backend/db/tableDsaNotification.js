const tableName = 'tableDsaNotification';

// === Column Names ===
const columnId = 'id';                 // TEXT PK (uuid) -> extern erzeugt
const columnNoticeId = 'noticeId';     // TEXT NULL, FK -> tableDsaNotice(id)
const columnDecisionId = 'decisionId'; // TEXT NULL, FK -> tableDsaDecision(id)
const columnStakeholder = 'stakeholder'; // TEXT NOT NULL: 'reporter' | 'uploader' | 'other'
const columnChannel = 'channel';       // TEXT NOT NULL: 'email' | 'inapp' | 'webhook'
const columnSentAt = 'sentAt';         // INTEGER NOT NULL (unix ms)
const columnPayload = 'payload';       // TEXT NOT NULL (serialisiertes JSON des Versand-Bodys)
const columnMeta = 'meta';             // TEXT NULL (z. B. Message-ID des Providers, Response-Codes)

// === INIT: create table + indexes ===
const init = function (db) {
    try {
        const sql = `
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS ${tableName} (
        ${columnId} TEXT PRIMARY KEY NOT NULL,
        ${columnNoticeId} TEXT DEFAULT NULL,
        ${columnDecisionId} TEXT DEFAULT NULL,
        ${columnStakeholder} TEXT NOT NULL,
        ${columnChannel} TEXT NOT NULL,
        ${columnSentAt} INTEGER NOT NULL,
        ${columnPayload} TEXT NOT NULL,
        ${columnMeta} TEXT DEFAULT NULL,
        CONSTRAINT fk_${tableName}_notice
          FOREIGN KEY (${columnNoticeId})
          REFERENCES tableDsaNotice(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL,
        CONSTRAINT fk_${tableName}_decision
          FOREIGN KEY (${columnDecisionId})
          REFERENCES tableDsaDecision(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_dsa_notification_notice
        ON ${tableName}(${columnNoticeId});

      CREATE INDEX IF NOT EXISTS idx_dsa_notification_decision
        ON ${tableName}(${columnDecisionId});

      CREATE INDEX IF NOT EXISTS idx_dsa_notification_sentAt_desc
        ON ${tableName}(${columnSentAt} DESC);

      CREATE INDEX IF NOT EXISTS idx_dsa_notification_channel
        ON ${tableName}(${columnChannel});
    `;
        db.exec(sql, (err) => { if (err) throw err; });
    } catch (err) {
        throw err;
    }
};

// ——— Helpers ———

/**
 * Notification anlegen.
 * @param {import('sqlite3').Database} db
 * @param {string} id
 * @param {string|null} noticeId
 * @param {string|null} decisionId
 * @param {string} stakeholder   // 'reporter' | 'uploader' | 'other'
 * @param {string} channel       // 'email' | 'inapp' | 'webhook'
 * @param {number} sentAt        // Unix ms
 * @param {string} payloadJson   // serialisiertes JSON (Body)
 * @param {string|null} metaJson // optional (Provider-Response etc.)
 * @param {(err: any, row?: { id: string }) => void} callBack
 */
const create = function (
    db,
    id,
    noticeId,
    decisionId,
    stakeholder,
    channel,
    sentAt,
    payloadJson,
    metaJson,
    callBack
) {
    const stmt = `
    INSERT INTO ${tableName} (
      ${columnId},
      ${columnNoticeId},
      ${columnDecisionId},
      ${columnStakeholder},
      ${columnChannel},
      ${columnSentAt},
      ${columnPayload},
      ${columnMeta}
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
    const params = [id, noticeId, decisionId, stakeholder, channel, sentAt, payloadJson, metaJson];

    db.run(stmt, params, function (err) {
        if (err) return callBack(err);
        callBack(null, { id });
    });
};

/**
 * Notification per ID.
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
 * Notifications für Notice oder Decision listen (mit Pagination).
 * @param {import('sqlite3').Database} db
 * @param {{
 *  noticeId?: string|null,
 *  decisionId?: string|null,
 *  channel?: string,
 *  stakeholder?: string,
 *  limit?: number,
 *  offset?: number
 * }} opts
 * @param {(err: any, rows?: any[]) => void} callBack
 */
const list = function (db, opts, callBack) {
    const where = [];
    const params = [];

    if (opts?.noticeId != null) {
        where.push(`${columnNoticeId} = ?`);
        params.push(opts.noticeId);
    }
    if (opts?.decisionId != null) {
        where.push(`${columnDecisionId} = ?`);
        params.push(opts.decisionId);
    }
    if (opts?.channel) {
        where.push(`${columnChannel} = ?`);
        params.push(opts.channel);
    }
    if (opts?.stakeholder) {
        where.push(`${columnStakeholder} = ?`);
        params.push(opts.stakeholder);
    }

    let sql = `SELECT * FROM ${tableName}`;
    if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
    sql += ` ORDER BY ${columnSentAt} DESC`;

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
        decisionId: columnDecisionId,
        stakeholder: columnStakeholder,
        channel: columnChannel,
        sentAt: columnSentAt,
        payload: columnPayload,
        meta: columnMeta
    },
    init,
    create,
    getById,
    list
};