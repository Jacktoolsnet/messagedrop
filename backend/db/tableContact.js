const tableName = 'tableContact';

const columnContactId = 'id';
const columnUserId = 'userId';
const columnUserEncryptedMessage = 'userEncryptedMessage';
const columnUserSignature = 'userSignature';
const columnContactUserId = 'contactUserId';
const columnContactUserSigningPublicKey = "contactUserSigningPublicKey";
const columnContactUserEncryptionPublicKey = 'contactUserEncryptionPublicKey';
const columnContactUserEncryptedMessage = 'contactUserEncryptedMessage';
const columnContactUserSignature = 'contactUserSignature';
const columnSubscribed = 'subscribed';
const columnHint = 'hint';
const columnName = 'name';
const columnLastMessageFrom = 'lastMessageFrom';

const init = function (db) {
    try {
        const sql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
            ${columnContactId} TEXT PRIMARY KEY NOT NULL, 
            ${columnUserId} TEXT DEFAULT NULL,
            ${columnUserEncryptedMessage} TEXT DEFAULT NULL,
            ${columnUserSignature} TEXT DEFAULT NULL,
            ${columnContactUserId} TEXT DEFAULT NULL,
            ${columnContactUserSigningPublicKey} TEXT NOT NULL,
            ${columnContactUserEncryptionPublicKey} TEXT NOT NULL,
            ${columnContactUserEncryptedMessage} TEXT DEFAULT NULL,
            ${columnContactUserSignature} TEXT DEFAULT NULL,
            ${columnSubscribed} BOOLEAN NOT NULL DEFAULT false,
            ${columnHint} TEXT DEFAULT NULL,
            ${columnName} TEXT DEFAULT NULL,
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

const create = function (db, contactId, userId, contactUserId, hint, contactUserSigningPublicKey, contactUserEncryptionPublicKey, callback) {
    try {
        let sql = `
        INSERT INTO ${tableName} (
            ${columnContactId},
            ${columnUserId},
            ${columnContactUserId},
            ${columnContactUserSigningPublicKey},
            ${columnContactUserEncryptionPublicKey},
            ${columnHint}
        ) VALUES (
            '${contactId}',
            '${userId}',
            '${contactUserId}',
            '${contactUserSigningPublicKey}',
            '${contactUserEncryptionPublicKey}',
            '${hint}'
        );`;
        db.run(sql, (err) => {
            callback(err)
        });
    } catch (error) {
        throw error;
    }
};

const updateName = function (db, contactId, name, callback) {
    try {
        let sql = `
        UPDATE ${tableName}
        SET ${columnName} = '${name}'
        WHERE ${columnContactId} = ?;`;

        db.run(sql, [contactId], (err) => {
            callback(err);
        });
    } catch (error) {
        throw error;
    }
};

const updateUserMessage = function (db, contactId, encryptedMessage, messageSignature, callback) {
    try {
        let sql = `
        UPDATE ${tableName}
        SET ${columnUserEncryptedMessage} = '${encryptedMessage}',
        ${columnUserSignature} = '${messageSignature}',
        ${columnLastMessageFrom} = 'user'
        WHERE ${columnContactId} = ?;`;

        db.run(sql, [contactId], (err) => {
            callback(err);
        });
    } catch (error) {
        throw error;
    }
};

const updateContactUserMessage = function (db, userId, contactUserId, encryptedMessage, messageSignature, callback) {
    try {
        let sql = `
        UPDATE ${tableName}
        SET ${columnContactUserEncryptedMessage} = '${encryptedMessage}',
        ${columnContactUserSignature} = '${messageSignature}',
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
    updateName,
    updateUserMessage,
    updateContactUserMessage,
    subscribe,
    unsubscribe,
    getById,
    getByUserId,
    deleteById
}