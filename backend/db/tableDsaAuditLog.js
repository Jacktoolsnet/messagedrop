const tableName = 'tableDsaAuditLog';

// === Column Names ===
const columnId = 'id';             // TEXT PK (uuid) -> extern erzeugt
const columnEntityType = 'entityType'; // TEXT NOT NULL: 'signal' | 'notice' | 'decision' | 'appeal' | 'notification' | 'other'
const columnEntityId = 'entityId'; // TEXT NOT NULL: ID der betroffenen Entität (z. B. tableDsaNotice.id)
const columnAction = 'action';     // TEXT NOT NULL: 'create' | 'update' | 'status_change' | 'notify' | 'delete' | ...
const columnActor = 'actor';       // TEXT NOT NULL: 'system' | 'user:<id>' | 'admin:<id>' | ...
const columnAt = 'at';             // INTEGER NOT NULL (unix ms)
const columnDetailsJson = 'detailsJson'; // TEXT NULL – serialisierte Zusatzinfos

// === INIT: create table + indexes ===
const init = function (db) {
    try {
        const sql = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        ${columnId} TEXT PRIMARY KEY NOT NULL,
        ${columnEntityType} TEXT NOT NULL,
        ${columnEntityId} TEXT NOT NULL,
        ${columnAction} TEXT NOT NULL,
        ${columnActor} TEXT NOT NULL,
        ${columnAt} INTEGER NOT NULL,
        ${columnDetailsJson} TEXT DEFAULT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_dsa_audit_entity
        ON ${tableName}(${columnEntityType}, ${columnEntityId});

      CREATE INDEX IF NOT EXISTS idx_dsa_audit_at_desc
        ON ${tableName}(${columnAt} DESC);

      CREATE INDEX IF NOT EXISTS idx_dsa_audit_action
        ON ${tableName}(${columnAction});
    `;
        db.exec(sql, (err) => { if (err) throw err; });
    } catch (err) {
        throw err;
    }
};

// ——— Helpers ———

/**
 * Audit-Event schreiben (alle Parameter explizit; Validierung erfolgt in der Route).
 * @param {import('sqlite3').Database} db
 * @param {string} id
 * @param {string} entityType
 * @param {string} entityId
 * @param {string} action
 * @param {string} actor
 * @param {number} at
 * @param {string|null} detailsJson
 * @param {(err: any, row?: { id: string }) => void} callBack
 */
const create = function (
    db,
    id,
    entityType,
    entityId,
    action,
    actor,
    at,
    detailsJson,
    callBack
) {
    const stmt = `
    INSERT INTO ${tableName} (
      ${columnId},
      ${columnEntityType},
      ${columnEntityId},
      ${columnAction},
      ${columnActor},
      ${columnAt},
      ${columnDetailsJson}
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

    const params = [id, entityType, entityId, action, actor, at, detailsJson];

    db.run(stmt, params, function (err) {
        if (err) return callBack(err);
        callBack(null, { id });
    });
};

/**
 * Ein Audit-Event per ID.
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
 * Liste aller Audit-Events zu einer Entität (mit Pagination).
 * @param {import('sqlite3').Database} db
 * @param {{
 *  entityType: string,
 *  entityId: string,
 *  limit?: number,
 *  offset?: number
 * }} opts
 * @param {(err: any, rows?: any[]) => void} callBack
 */
const listByEntity = function (db, opts, callBack) {
    let sql = `
    SELECT * FROM ${tableName}
     WHERE ${columnEntityType} = ? AND ${columnEntityId} = ?
     ORDER BY ${columnAt} DESC
  `;
    const limit = Number.isFinite(opts?.limit) ? opts.limit : 200;
    const offset = Number.isFinite(opts?.offset) ? opts.offset : 0;
    sql += ` LIMIT ${limit} OFFSET ${offset}`;

    db.all(sql, [opts.entityType, opts.entityId], (err, rows) => {
        if (err) return callBack(err);
        callBack(null, rows);
    });
};

/**
 * Freie Suche/Listing (optional filterbar nach action/actor/time range).
 * @param {import('sqlite3').Database} db
 * @param {{
 *  action?: string,
 *  actor?: string,
 *  fromAt?: number,
 *  toAt?: number,
 *  limit?: number,
 *  offset?: number
 * }} [opts]
 * @param {(err: any, rows?: any[]) => void} callBack
 */
const list = function (db, opts, callBack) {
    const where = [];
    const params = [];

    if (opts?.action) {
        where.push(`${columnAction} = ?`);
        params.push(opts.action);
    }
    if (opts?.actor) {
        where.push(`${columnActor} = ?`);
        params.push(opts.actor);
    }
    if (Number.isFinite(opts?.fromAt)) {
        where.push(`${columnAt} >= ?`);
        params.push(opts.fromAt);
    }
    if (Number.isFinite(opts?.toAt)) {
        where.push(`${columnAt} <= ?`);
        params.push(opts.toAt);
    }

    let sql = `SELECT * FROM ${tableName}`;
    if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
    sql += ` ORDER BY ${columnAt} DESC`;

    const limit = Number.isFinite(opts?.limit) ? opts.limit : 200;
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
        entityType: columnEntityType,
        entityId: columnEntityId,
        action: columnAction,
        actor: columnActor,
        at: columnAt,
        detailsJson: columnDetailsJson
    },
    init,
    create,
    getById,
    listByEntity,
    list
};