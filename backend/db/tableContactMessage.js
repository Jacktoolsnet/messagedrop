const tableName = 'tableContactMessage';
const deletedEventTableName = 'tableContactMessageDeletedEvent';

const columnId = 'id';
const columnMessageId = 'messageId';
const columnContactId = 'contactId';
const columnDirection = 'direction'; // 'user' | 'contactUser'
const columnMessage = 'message';
const columnSignature = 'signature';
const columnTranslatedMessage = 'translatedMessage';
const columnCreatedAt = 'createdAt'; // ISO8601
const columnReadAt = 'readAt';       // ISO8601 | NULL
const columnStatus = 'status';       // sent | delivered | read | deleted
const columnReaction = 'reaction';   // nullable TEXT emoji/keyword
const deletedEventColumnId = 'id';
const deletedEventColumnContactId = 'contactId';
const deletedEventColumnMessageId = 'messageId';
const deletedEventColumnDeletedAt = 'deletedAt';

const init = function (db) {
    const sql = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      ${columnId} TEXT PRIMARY KEY NOT NULL,
      ${columnContactId} TEXT NOT NULL,
      ${columnMessageId} TEXT NOT NULL,
      ${columnDirection} TEXT NOT NULL CHECK (${columnDirection} IN ('user','contactUser')),
      ${columnMessage} TEXT NOT NULL,
      ${columnSignature} TEXT NOT NULL,
      ${columnTranslatedMessage} TEXT DEFAULT NULL,
      ${columnStatus} TEXT NOT NULL DEFAULT 'sent' CHECK (${columnStatus} IN ('sent','delivered','read','deleted')),
      ${columnCreatedAt} TEXT NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS')),
      ${columnReadAt} TEXT DEFAULT NULL,
      ${columnReaction} TEXT DEFAULT NULL,
      FOREIGN KEY (${columnContactId})
        REFERENCES tableContact (id)
        ON UPDATE CASCADE ON DELETE CASCADE
    );

    -- Häufige Abfragen beschleunigen:
    CREATE INDEX IF NOT EXISTS idx_msg_contact_created
      ON ${tableName} (${columnContactId}, ${columnCreatedAt} DESC);

    CREATE INDEX IF NOT EXISTS idx_msg_message_id
      ON ${tableName} (${columnMessageId});

    -- Unread schnell zählen/finden:
    CREATE INDEX IF NOT EXISTS idx_msg_contact_unread
      ON ${tableName} (${columnContactId})
      WHERE ${columnReadAt} IS NULL;
  `;
    db.exec(sql, (err) => { if (err) throw err; });

    const deletedEventSql = `
    CREATE TABLE IF NOT EXISTS ${deletedEventTableName} (
      ${deletedEventColumnId} INTEGER PRIMARY KEY AUTOINCREMENT,
      ${deletedEventColumnContactId} TEXT NOT NULL,
      ${deletedEventColumnMessageId} TEXT NOT NULL,
      ${deletedEventColumnDeletedAt} TEXT NOT NULL DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'))
    );

    CREATE INDEX IF NOT EXISTS idx_msg_deleted_event_contact_id
      ON ${deletedEventTableName} (${deletedEventColumnContactId}, ${deletedEventColumnId});

    CREATE INDEX IF NOT EXISTS idx_msg_deleted_event_deleted_at
      ON ${deletedEventTableName} (${deletedEventColumnDeletedAt});
  `;
    db.exec(deletedEventSql, (err) => { if (err) throw err; });

    db.all(`PRAGMA table_info(${tableName});`, (err, rows) => {
        if (err || !rows) {
            return;
        }
        const hasTranslation = rows.some((row) => row.name === columnTranslatedMessage);
        if (!hasTranslation) {
            db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnTranslatedMessage} TEXT DEFAULT NULL;`);
        }
    });

    // Trigger: Bei neuer Nachricht den Denormalisierer im Kontakt füttern (optional)
    const trig = `
    CREATE TRIGGER IF NOT EXISTS trg_contact_last_from
    AFTER INSERT ON ${tableName}
    BEGIN
      UPDATE tableContact
      SET lastMessageFrom = NEW.${columnDirection},
          lastMessageAt = NEW.${columnCreatedAt}
      WHERE id = NEW.${columnContactId};
    END;
  `;
    db.exec(trig, (err) => { if (err) throw err; });

    const deleteTrig = `
    CREATE TRIGGER IF NOT EXISTS trg_contact_message_deleted_event
    AFTER DELETE ON ${tableName}
    BEGIN
      INSERT INTO ${deletedEventTableName}
      (${deletedEventColumnContactId}, ${deletedEventColumnMessageId}, ${deletedEventColumnDeletedAt})
      VALUES (OLD.${columnContactId}, OLD.${columnMessageId}, to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'));
    END;
  `;
    db.exec(deleteTrig, (err) => { if (err) throw err; });
};

// Nachrichten-CRUD
const createMessage = function (db, {
    id,            // uuid
    messageId,     // shared uuid across sender/recipient copies
    contactId,
    direction,     // 'user' | 'contactUser'
    message,
    signature,
    status = 'sent',
    createdAt, // optional ISO, else default
    readAt, // optional ISO, else default (only used for sender to avoid unread)
    reaction // optional
}, callback) {
    // Eigene Nachrichten gelten sofort als gelesen
    const normalizedReadAt = readAt ?? (direction === 'user' ? new Date().toISOString() : null);
    const sql = `
    INSERT INTO ${tableName}
      (${columnId}, ${columnContactId}, ${columnMessageId}, ${columnDirection},
       ${columnMessage}, ${columnSignature}, ${columnStatus}, ${columnCreatedAt}, ${columnReadAt}, ${columnReaction})
    VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS')), ?, ?);
  `;
    const params = [id, contactId, messageId, direction, message, signature, status, createdAt ?? null, normalizedReadAt, reaction ?? null];
    db.run(sql, params, (err) => callback(err));
};

// Als gelesen markieren
const markAsRead = function (db, messageId, callback) {
    const sql = `
    UPDATE ${tableName}
    SET ${columnReadAt} = COALESCE(${columnReadAt}, to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS')),
        ${columnStatus} = 'read'
    WHERE ${columnId} = ?;
  `;
    db.run(sql, [messageId], (err) => callback(err));
};

const markManyAsReadByContact = function (db, contactId, beforeIso, callback) {
    const sql = `
    UPDATE ${tableName}
    SET ${columnReadAt} = COALESCE(${columnReadAt}, to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS')),
        ${columnStatus} = 'read'
    WHERE ${columnContactId} = ?
      AND ${columnReadAt} IS NULL
      AND ${columnCreatedAt} <= COALESCE(?, to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'));
  `;
    db.run(sql, [contactId, beforeIso ?? null], (err) => callback(err));
};

// Aktive Nachrichten (für UI):
// - Ungelesen: immer zeigen
// - Gelesen: nur zeigen, wenn readAt > now - 7 Tage
const getActiveByContact = function (db, contactId, limit = 100, offset = 0, beforeIso, callback) {
    const sql = `
    SELECT *
    FROM ${tableName}
    WHERE ${columnContactId} = ?
      AND (
        ${columnReadAt} IS NULL
        OR ${columnReadAt} > to_char((CURRENT_TIMESTAMP - INTERVAL '7 days') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS')
      )
      AND (${columnCreatedAt} < COALESCE(?, to_char((CURRENT_TIMESTAMP + INTERVAL '1 day') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS')))
    ORDER BY ${columnCreatedAt} DESC
    LIMIT ? OFFSET ?;
  `;
    db.all(sql, [contactId, beforeIso ?? null, limit, offset], (err, rows) => callback(err, rows));
};

// Unread Count pro Kontakt
const getUnreadCount = function (db, contactId, callback) {
    const sql = `
    SELECT COUNT(*) AS cnt
    FROM ${tableName}
    WHERE ${columnContactId} = ?
      AND ${columnReadAt} IS NULL
      AND ${columnDirection} = 'contactUser';
  `;
    db.get(sql, [contactId], (err, row) => callback(err, row?.cnt ?? 0));
};

// Cleanup: löscht nur "gelesen" & älter als 7 Tage
const cleanupReadMessages = function (db, callback) {
    const sql = `
    DELETE FROM ${tableName}
    WHERE ${columnReadAt} IS NOT NULL
      AND ${columnReadAt} <= to_char((CURRENT_TIMESTAMP - INTERVAL '7 days') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS');
  `;
    db.run(sql, [], (err) => callback(err));
};

const updateMessageByMessageId = function (db, messageId, {
    message,
    signature,
    status = 'sent',
    reaction
}, callback) {
    const sql = `
    UPDATE ${tableName}
    SET ${columnMessage} = COALESCE(?, ${columnMessage}),
        ${columnSignature} = COALESCE(?, ${columnSignature}),
        ${columnStatus} = COALESCE(?, ${columnStatus}),
        ${columnReaction} = COALESCE(?, ${columnReaction})
    WHERE ${columnMessageId} = ?;
  `;
    db.run(sql, [message ?? null, signature ?? null, status ?? null, reaction ?? null, messageId], (err) => callback(err));
};

const updateMessageForContact = function (db, contactId, messageId, {
    message,
    signature,
    status = 'sent',
    reaction
}, callback) {
    const sql = `
    UPDATE ${tableName}
    SET ${columnMessage} = COALESCE(?, ${columnMessage}),
        ${columnSignature} = COALESCE(?, ${columnSignature}),
        ${columnStatus} = COALESCE(?, ${columnStatus}),
        ${columnReaction} = COALESCE(?, ${columnReaction})
    WHERE ${columnMessageId} = ?
      AND ${columnContactId} = ?;
  `;
    db.run(sql, [message ?? null, signature ?? null, status ?? null, reaction ?? null, messageId, contactId], (err) => callback(err));
};

const setTranslatedMessageForContact = function (db, contactId, messageId, translatedMessage, callback) {
    const sql = `
    UPDATE ${tableName}
    SET ${columnTranslatedMessage} = ?
    WHERE ${columnMessageId} = ?
      AND ${columnContactId} = ?;
  `;
    db.run(sql, [translatedMessage ?? null, messageId, contactId], (err) => callback(err));
};

const deleteByMessageId = function (db, messageId, callback) {
    const sql = `
    DELETE FROM ${tableName}
    WHERE ${columnMessageId} = ?;
  `;
    db.run(sql, [messageId], (err) => callback(err));
};

const deleteByContactAndMessageId = function (db, contactId, messageId, callback) {
    const sql = `
    DELETE FROM ${tableName}
    WHERE ${columnMessageId} = ?
      AND ${columnContactId} = ?;
  `;
    db.run(sql, [messageId, contactId], (err) => callback(err));
};

const markAsReadByContactAndMessageId = function (db, contactId, messageId, callback) {
    const sql = `
    UPDATE ${tableName}
    SET ${columnReadAt} = COALESCE(${columnReadAt}, to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS')),
        ${columnStatus} = 'read'
    WHERE ${columnContactId} = ?
      AND ${columnMessageId} = ?;
  `;
    db.run(sql, [contactId, messageId], (err) => callback(err));
};

const setReactionForContact = function (db, contactId, messageId, reaction, callback) {
    const sql = `
    UPDATE ${tableName}
    SET ${columnReaction} = ?
    WHERE ${columnContactId} = ?
      AND ${columnMessageId} = ?;
  `;
    db.run(sql, [reaction ?? null, contactId, messageId], (err) => callback(err));
};

const setReactionByMessageId = function (db, messageId, reaction, callback) {
    const sql = `
    UPDATE ${tableName}
    SET ${columnReaction} = ?
    WHERE ${columnMessageId} = ?;
  `;
    db.run(sql, [reaction ?? null, messageId], (err) => callback(err));
};

const clearPayloadByContactAndMessageIds = function (db, contactId, messageIds, callback) {
    const normalizedMessageIds = Array.isArray(messageIds)
        ? [...new Set(messageIds
            .map((id) => (typeof id === 'string' ? id.trim() : ''))
            .filter(Boolean))]
        : [];
    if (!contactId || normalizedMessageIds.length === 0) {
        callback(null, 0);
        return;
    }
    const placeholders = normalizedMessageIds.map(() => '?').join(', ');
    const sql = `
    UPDATE ${tableName}
    SET ${columnMessage} = ''
    WHERE ${columnContactId} = ?
      AND ${columnMessageId} IN (${placeholders})
      AND ${columnMessage} <> '';
  `;
    db.run(sql, [contactId, ...normalizedMessageIds], function (err) {
        callback(err, this?.changes ?? 0);
    });
};

const getDeletedEventsByContact = function (db, contactId, sinceId = 0, limit = 500, callback) {
    const normalizedSince = Number.isFinite(sinceId) ? Math.max(0, Math.floor(sinceId)) : 0;
    const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(1000, Math.floor(limit))) : 500;
    const sql = `
    SELECT ${deletedEventColumnId} AS id, ${deletedEventColumnMessageId} AS messageId
    FROM ${deletedEventTableName}
    WHERE ${deletedEventColumnContactId} = ?
      AND ${deletedEventColumnId} > ?
    ORDER BY ${deletedEventColumnId} ASC
    LIMIT ?;
  `;
    db.all(sql, [contactId, normalizedSince, normalizedLimit], (err, rows) => {
        if (err) {
            callback(err);
            return;
        }
        const safeRows = rows || [];
        const messageIds = [...new Set(safeRows
            .map((row) => row?.messageId)
            .filter((messageId) => typeof messageId === 'string' && messageId.trim() !== ''))];
        const nextCursor = safeRows.length
            ? Number(safeRows[safeRows.length - 1]?.id) || normalizedSince
            : normalizedSince;
        callback(null, { messageIds, nextCursor });
    });
};

const cleanupDeletedEvents = function (db, retentionDays = 30, callback) {
    const normalizedDays = Number.isFinite(retentionDays)
        ? Math.max(1, Math.floor(retentionDays))
        : 30;
    const sql = `
    DELETE FROM ${deletedEventTableName}
    WHERE ${deletedEventColumnDeletedAt} <= to_char((CURRENT_TIMESTAMP - ($1::BIGINT * INTERVAL '1 day')) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS');
  `;
    db.run(sql, [normalizedDays], (err) => callback(err));
};

module.exports = {
    init,
    createMessage,
    columnReaction,
    markAsRead,
    markManyAsReadByContact,
    getActiveByContact,
    getUnreadCount,
    cleanupReadMessages,
    columnContactId,
    columnDirection,
    columnMessageId,
    updateMessageByMessageId,
    updateMessageForContact,
    setTranslatedMessageForContact,
    deleteByMessageId,
    deleteByContactAndMessageId,
    markAsReadByContactAndMessageId,
    setReactionForContact,
    setReactionByMessageId,
    clearPayloadByContactAndMessageIds,
    getDeletedEventsByContact,
    cleanupDeletedEvents,
};
