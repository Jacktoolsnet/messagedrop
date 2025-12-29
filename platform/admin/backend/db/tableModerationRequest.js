const tableName = 'tableModerationRequest';

const columnId = 'id';
const columnMessageId = 'messageId';
const columnMessageUuid = 'messageUuid';
const columnMessageUserId = 'messageUserId';
const columnMessageText = 'messageText';
const columnMessageType = 'messageType';
const columnMessageCreatedAt = 'messageCreatedAt';
const columnLatitude = 'latitude';
const columnLongitude = 'longitude';
const columnPlusCode = 'plusCode';
const columnMarkerType = 'markerType';
const columnStyle = 'style';
const columnAiScore = 'aiScore';
const columnAiFlagged = 'aiFlagged';
const columnAiDecision = 'aiDecision';
const columnAiResponse = 'aiResponse';
const columnPatternMatch = 'patternMatch';
const columnPatternMatchAt = 'patternMatchAt';
const columnStatus = 'status';
const columnCreatedAt = 'createdAt';
const columnResolvedAt = 'resolvedAt';
const columnResolvedBy = 'resolvedBy';
const columnResolutionReason = 'resolutionReason';

const statusValues = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected'
};

const init = function (db) {
    const sql = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
        ${columnId} TEXT PRIMARY KEY NOT NULL,
        ${columnMessageId} INTEGER DEFAULT NULL,
        ${columnMessageUuid} TEXT NOT NULL,
        ${columnMessageUserId} TEXT NOT NULL,
        ${columnMessageText} TEXT NOT NULL,
        ${columnMessageType} TEXT DEFAULT NULL,
        ${columnMessageCreatedAt} INTEGER DEFAULT NULL,
        ${columnLatitude} REAL DEFAULT NULL,
        ${columnLongitude} REAL DEFAULT NULL,
        ${columnPlusCode} TEXT DEFAULT NULL,
        ${columnMarkerType} TEXT DEFAULT NULL,
        ${columnStyle} TEXT DEFAULT NULL,
        ${columnAiScore} REAL DEFAULT NULL,
        ${columnAiFlagged} INTEGER DEFAULT NULL,
        ${columnAiDecision} TEXT DEFAULT NULL,
        ${columnAiResponse} TEXT DEFAULT NULL,
        ${columnPatternMatch} INTEGER DEFAULT NULL,
        ${columnPatternMatchAt} INTEGER DEFAULT NULL,
        ${columnStatus} TEXT NOT NULL DEFAULT '${statusValues.PENDING}',
        ${columnCreatedAt} INTEGER NOT NULL,
        ${columnResolvedAt} INTEGER DEFAULT NULL,
        ${columnResolvedBy} TEXT DEFAULT NULL,
        ${columnResolutionReason} TEXT DEFAULT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_moderation_status_created
        ON ${tableName}(${columnStatus}, ${columnCreatedAt} DESC);
    CREATE INDEX IF NOT EXISTS idx_moderation_message_uuid
        ON ${tableName}(${columnMessageUuid});
    `;
    db.exec(sql, (err) => {
        if (err) throw err;
    });
};

const create = function (db, payload, callback) {
    const sql = `
    INSERT INTO ${tableName} (
        ${columnId},
        ${columnMessageId},
        ${columnMessageUuid},
        ${columnMessageUserId},
        ${columnMessageText},
        ${columnMessageType},
        ${columnMessageCreatedAt},
        ${columnLatitude},
        ${columnLongitude},
        ${columnPlusCode},
        ${columnMarkerType},
        ${columnStyle},
        ${columnAiScore},
        ${columnAiFlagged},
        ${columnAiDecision},
        ${columnAiResponse},
        ${columnPatternMatch},
        ${columnPatternMatchAt},
        ${columnStatus},
        ${columnCreatedAt}
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    const params = [
        payload.id,
        payload.messageId ?? null,
        payload.messageUuid,
        payload.messageUserId,
        payload.messageText,
        payload.messageType ?? null,
        payload.messageCreatedAt ?? null,
        payload.latitude ?? null,
        payload.longitude ?? null,
        payload.plusCode ?? null,
        payload.markerType ?? null,
        payload.style ?? null,
        payload.aiScore ?? null,
        payload.aiFlagged ?? null,
        payload.aiDecision ?? null,
        payload.aiResponse ?? null,
        payload.patternMatch ?? null,
        payload.patternMatchAt ?? null,
        payload.status ?? statusValues.PENDING,
        payload.createdAt
    ];
    db.run(sql, params, (err) => callback(err));
};

const list = function (db, options, callback) {
    const limit = Number.isFinite(options?.limit) ? Math.max(1, Math.min(500, options.limit)) : 200;
    const offset = Number.isFinite(options?.offset) ? Math.max(0, options.offset) : 0;
    const status = options?.status ? String(options.status) : statusValues.PENDING;
    const params = [];
    let where = '';
    if (status && status !== 'all') {
        where = `WHERE ${columnStatus} = ?`;
        params.push(status);
    }
    const sql = `
    SELECT *
    FROM ${tableName}
    ${where}
    ORDER BY ${columnCreatedAt} DESC
    LIMIT ? OFFSET ?;
    `;
    params.push(limit, offset);
    db.all(sql, params, (err, rows) => callback(err, rows || []));
};

const getById = function (db, id, callback) {
    const sql = `SELECT * FROM ${tableName} WHERE ${columnId} = ? LIMIT 1`;
    db.get(sql, [id], (err, row) => callback(err, row));
};

const updateResolution = function (db, id, status, resolvedAt, resolvedBy, resolutionReason, callback) {
    const sql = `
    UPDATE ${tableName}
    SET ${columnStatus} = ?,
        ${columnResolvedAt} = ?,
        ${columnResolvedBy} = ?,
        ${columnResolutionReason} = ?
    WHERE ${columnId} = ?;
    `;
    db.run(sql, [status, resolvedAt, resolvedBy, resolutionReason, id], (err) => callback(err));
};

const deleteById = function (db, id, callback) {
    const sql = `DELETE FROM ${tableName} WHERE ${columnId} = ?`;
    db.run(sql, [id], function (err) {
        callback(err, this?.changes > 0);
    });
};

module.exports = {
    tableName,
    statusValues,
    init,
    create,
    list,
    getById,
    updateResolution,
    deleteById
};
