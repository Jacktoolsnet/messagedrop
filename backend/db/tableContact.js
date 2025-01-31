const tableName = 'tableContact';

const columnContactId = 'id';
const columnUserId = 'userId';
const columnUserMessage = 'userMessage';
const columnUserMessageStyle = 'userMessageStyle';
const columnContactUserId = 'contactUserId';
const columnContactEncryptionPublicKey = 'contactEncryptionPublicKey';
const columnContactSigningPublicKey = "contactSigningPublicKey";
const columnContactUserMessage = 'contactUserMessage';
const columnContactUserMessageStyle = 'contactUserMessageStyle';
const columnSubscribed = 'subscribed';
const columnHint = 'hint';
const columnName = 'name';
const columnBase64Avatar = 'base64Avatar';
const columnLastMessageFrom = 'lastMessageFrom';

const init = function (db) {
    try {
        const sql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
            ${columnContactId} TEXT PRIMARY KEY NOT NULL, 
            ${columnUserId} TEXT DEFAULT NULL,
            ${columnUserMessage} TEXT DEFAULT NULL,
            ${columnUserMessageStyle} TEXT DEFAULT NULL,
            ${columnContactUserId} TEXT DEFAULT NULL,
            ${columnContactEncryptionPublicKey} TEXT NOT NULL,
            ${columnContactSigningPublicKey} TEXT NOT NULL,
            ${columnContactUserMessage} TEXT DEFAULT NULL,
            ${columnContactUserMessageStyle} TEXT DEFAULT NULL,
            ${columnSubscribed} BOOLEAN NOT NULL DEFAULT false,
            ${columnHint} TEXT DEFAULT NULL,
            ${columnName} TEXT DEFAULT NULL,
            ${columnBase64Avatar} TEXT DEFAULT NULL,
            ${columnLastMessageFrom} TEXT DEFAULT '',
            CONSTRAINT SECONDARY_KEY UNIQUE (${columnUserId}, ${columnContactUserId}),
            CONSTRAINT FK_USER_ID FOREIGN KEY (${columnUserId}) 
            REFERENCES tableUser (id) 
            ON UPDATE CASCADE ON DELETE CASCADE,
            CONSTRAINT FK_CONTACT_USER_ID FOREIGN KEY (${columnContactUserId}) 
            REFERENCES tableUser (id) 
            ON UPDATE CASCADE ON DELETE CASCADE 
        );`;

        db.run(sql, (err) => {
            if (err) {
                throw err;
            }
        });
    } catch (error) {
        throw error;
    }
};

const create = function (db, contactId, userId, contactUserId, hint, contactEncryptionPublicKey, contactSigningPublicKey, callback) {
    try {
        let sql = `
        INSERT INTO ${tableName} (
            ${columnContactId},
            ${columnUserId},
            ${columnContactUserId},
            ${columnContactEncryptionPublicKey},
            ${columnContactSigningPublicKey},
            ${columnHint}
        ) VALUES (
            '${contactId}',
            '${userId}',
            '${contactUserId}',
            '${contactEncryptionPublicKey}',
            '${contactSigningPublicKey}',
            '${hint}'
        );`;
        db.run(sql, (err) => {
            callback(err)
        });
    } catch (error) {
        throw error;
    }
};

const update = function (db, contactId, name, base64Avatar, callback) {
    try {
        let sql = `
        UPDATE ${tableName}
        SET ${columnName} = '${name}', 
        ${columnBase64Avatar} = '${base64Avatar}'
        WHERE ${columnContactId} = ?;`;

        db.run(sql, [contactId], (err) => {
            callback(err);
        });
    } catch (error) {
        throw error;
    }
};

const updateUserMessage = function (db, contactId, message, style, callback) {
    try {
        let sql = `
        UPDATE ${tableName}
        SET ${columnUserMessage} = '${message}',
        ${columnUserMessageStyle} = '${style}',
        ${columnLastMessageFrom} = 'user'
        WHERE ${columnContactId} = ?;`;

        db.run(sql, [contactId], (err) => {
            callback(err);
        });
    } catch (error) {
        throw error;
    }
};

const updateContactUserMessage = function (db, userId, contactUserId, message, style, callback) {
    try {
        let sql = `
        UPDATE ${tableName}
        SET ${columnContactUserMessage} = '${message}',
        ${columnContactUserMessageStyle} = '${style}',
        ${columnLastMessageFrom} = 'contactUser'
        WHERE ${columnUserId} = ?
        AND ${columnContactUserId} = ?;`;

        db.run(sql, [contactUserId, userId], (err) => {
            callback(err);
        });
    } catch (error) {
        throw error;
    }
};

const subscribe = function (db, contactId, callback) {
    try {
        let sql = `
        UPDATE ${tableName}
        SET ${columnSubscribed} = true
        WHERE ${columnContactId} = ?;`;
        db.run(sql, [contactId], (err) => {
            callback(err);
        });
    } catch (error) {
        throw error;
    }
};

const unsubscribe = function (db, contactId, callback) {
    try {
        let sql = `
        UPDATE ${tableName}
        SET ${columnSubscribed} = false
        WHERE ${columnContactId} = ?;`;

        db.run(sql, [contactId], (err) => {
            callback(err);
        });
    } catch (error) {
        throw error;
    }
};

const getById = function (db, contactId, callback) {
    try {
        let sql = `
        SELECT * FROM ${tableName}
        WHERE ${columnContactId} = ?;`;

        db.get(sql, [contactId], (err, row) => {
            callback(err, row);
        });
    } catch (error) {
        throw error;
    }
};

const getByUserId = function (db, userId, callback) {
    try {
        let sql = `
        SELECT * FROM ${tableName}
        WHERE ${columnUserId} = ?
        ORDER BY ${columnContactId} ASC;`;
        db.all(sql, [userId], (err, rows) => {
            callback(err, rows);
        });
    } catch (error) {
        throw error;
    }
};

const deleteById = function (db, contactId, callback) {
    try {
        let sql = `
        DELETE FROM ${tableName}
        WHERE ${columnContactId} = ?;`;

        db.run(sql, [contactId], (err) => {
            if (err) {
                callback(err);
            } else {
                callback(err);
            }
        });
    } catch (error) {
        throw error;
    }
};

module.exports = {
    init,
    create,
    update,
    updateUserMessage,
    updateContactUserMessage,
    subscribe,
    unsubscribe,
    getById,
    getByUserId,
    deleteById
}