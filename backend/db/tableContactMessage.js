const tableName = 'tableContactMessage';

const columnId = 'id';
const columnContactId = 'contactId';
const columnDirection = 'direction'; // 'user' | 'contactUser'
const columnEncryptedMessage = 'encryptedMessage';
const columnSignature = 'signature';
const columnCreatedAt = 'createdAt'; // ISO8601
const columnReadAt = 'readAt';       // ISO8601 | NULL
const columnStatus = 'status';       // sent | delivered | read

const init = function (db) {
    const sql = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      ${columnId} TEXT PRIMARY KEY NOT NULL,
      ${columnContactId} TEXT NOT NULL,
      ${columnDirection} TEXT NOT NULL CHECK (${columnDirection} IN ('user','contactUser')),
      ${columnEncryptedMessage} TEXT NOT NULL,
      ${columnSignature} TEXT NOT NULL,
      ${columnStatus} TEXT NOT NULL DEFAULT 'sent' CHECK (${columnStatus} IN ('sent','delivered','read')),
      ${columnCreatedAt} TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S','now')),
      ${columnReadAt} TEXT DEFAULT NULL,
      FOREIGN KEY (${columnContactId})
        REFERENCES tableContact (id)
        ON UPDATE CASCADE ON DELETE CASCADE
    );

    -- Häufige Abfragen beschleunigen:
    CREATE INDEX IF NOT EXISTS idx_msg_contact_created
      ON ${tableName} (${columnContactId}, ${columnCreatedAt} DESC);

    -- Unread schnell zählen/finden:
    CREATE INDEX IF NOT EXISTS idx_msg_contact_unread
      ON ${tableName} (${columnContactId})
      WHERE ${columnReadAt} IS NULL;
  `;
    db.exec(sql, (err) => { if (err) throw err; });

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
};

// Nachrichten-CRUD
const createMessage = function (db, {
    id,            // uuid
    contactId,
    direction,     // 'user' | 'contactUser'
    encryptedMessage,
    signature,
    status = 'sent',
    createdAt, // optional ISO, else default
    readAt // optional ISO, else default (only used for sender to avoid unread)
}, callback) {
    // Eigene Nachrichten gelten sofort als gelesen
    const normalizedReadAt = readAt ?? (direction === 'user' ? new Date().toISOString() : null);
    const sql = `
    INSERT INTO ${tableName}
      (${columnId}, ${columnContactId}, ${columnDirection},
       ${columnEncryptedMessage}, ${columnSignature}, ${columnStatus}, ${columnCreatedAt}, ${columnReadAt})
    VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, strftime('%Y-%m-%dT%H:%M:%S','now')), ?);
  `;
    const params = [id, contactId, direction, encryptedMessage, signature, status, createdAt ?? null, normalizedReadAt];
    db.run(sql, params, (err) => callback(err));
};

// Als gelesen markieren
const markAsRead = function (db, messageId, callback) {
    const sql = `
    UPDATE ${tableName}
    SET ${columnReadAt} = COALESCE(${columnReadAt}, strftime('%Y-%m-%dT%H:%M:%S','now')),
        ${columnStatus} = 'read'
    WHERE ${columnId} = ?;
  `;
    db.run(sql, [messageId], (err) => callback(err));
};

const markManyAsReadByContact = function (db, contactId, beforeIso, callback) {
    const sql = `
    UPDATE ${tableName}
    SET ${columnReadAt} = COALESCE(${columnReadAt}, strftime('%Y-%m-%dT%H:%M:%S','now')),
        ${columnStatus} = 'read'
    WHERE ${columnContactId} = ?
      AND ${columnReadAt} IS NULL
      AND ${columnCreatedAt} <= COALESCE(?, strftime('%Y-%m-%dT%H:%M:%S','now'));
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
        OR ${columnReadAt} > datetime('now','-7 days')
      )
      AND (${columnCreatedAt} < COALESCE(?, datetime('now','+1 day')))
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
      AND ${columnReadAt} <= datetime('now','-7 days');
  `;
    db.run(sql, [], (err) => callback(err));
};

module.exports = {
    init,
    createMessage,
    markAsRead,
    markManyAsReadByContact,
    getActiveByContact,
    getUnreadCount,
    cleanupReadMessages,
    columnContactId,
    columnDirection,
};
