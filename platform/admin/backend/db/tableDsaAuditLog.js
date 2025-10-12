// db/tableDsaAuditLog.js
const tableName = 'tableDsaAuditLog';

// Columns
const columnId = 'id';
const columnEntityType = 'entityType';
const columnEntityId = 'entityId';
const columnAction = 'action';
const columnActor = 'actor';
const columnAt = 'at';
const columnDetailsJson = 'detailsJson';

// INIT
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

// CREATE
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

// GET BY ID
const getById = function (db, id, callBack) {
    const sql = `SELECT * FROM ${tableName} WHERE ${columnId} = ? LIMIT 1`;
    db.get(sql, [id], (err, row) => {
        if (err) return callBack(err);
        callBack(null, row);
    });
};

// LIST BY ENTITY
const listByEntity = function (db, opts, callBack) {
    let sql = `
    SELECT *
      FROM ${tableName}
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

// SIMPLE LIST (rückwärtskompatibel)
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

// NEW: ADVANCED SEARCH (entityType, action, actor, since/until, q)
const search = function (db, opts, callBack) {
    const where = [];
    const params = [];

    if (opts?.entityType) {
        where.push(`${columnEntityType} = ?`);
        params.push(opts.entityType);
    }
    if (opts?.action) {
        where.push(`${columnAction} = ?`);
        params.push(opts.action);
    }
    if (opts?.actor) {
        where.push(`${columnActor} = ?`);
        params.push(opts.actor);
    }
    if (Number.isFinite(opts?.since)) {
        where.push(`${columnAt} >= ?`);
        params.push(opts.since);
    }
    if (Number.isFinite(opts?.until)) {
        where.push(`${columnAt} <= ?`);
        params.push(opts.until);
    }
    if (opts?.q) {
        where.push(`(${columnActor} LIKE ? OR ${columnEntityId} LIKE ? OR ${columnAction} LIKE ?)`);
        params.push(`%${opts.q}%`, `%${opts.q}%`, `%${opts.q}%`);
    }

    let sql = `
    SELECT ${columnId} AS id,
           ${columnEntityType} AS entityType,
           ${columnEntityId} AS entityId,
           ${columnAction} AS action,
           ${columnActor} AS actor,
           ${columnAt} AS createdAt,
           ${columnDetailsJson} AS detailsJson
      FROM ${tableName}
  `;
    if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
    sql += ` ORDER BY ${columnAt} DESC`;

    const limit = Number.isFinite(opts?.limit) ? opts.limit : 100;
    const offset = Number.isFinite(opts?.offset) ? opts.offset : 0;
    sql += ` LIMIT ${limit} OFFSET ${offset}`;

    db.all(sql, params, (err, rows) => {
        if (err) return callBack(err);
        callBack(null, rows || []);
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
    list,
    search
};