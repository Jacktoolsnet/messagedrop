const tableName = 'tableContact';

const columnContactId = 'id';
const columnUserId = 'userId';
const columnContactUserId = 'contactUserId';
const columnSubscribed = 'subscribed';

const init = function (db) {
    try {
        const sql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
            ${columnContactId} TEXT PRIMARY KEY NOT NULL, 
            ${columnUserId} TEXT DEFAULT NULL,
            ${columnContactUserId} TEXT DEFAULT NULL,
            ${columnSubscribed} BOOLEAN NOT NULL DEFAULT false,
            CONSTRAINT SECONDARY_KEY UNIQUE (${columnUserId}, ${columnContactUserId}),
            CONSTRAINT FK_USER_ID FOREIGN KEY (${columnUserId}) 
            REFERENCES tableUser (id) 
            ON UPDATE CASCADE ON DELETE CASCADE 
        );`;

        db.run(sql, (err) => {
            if (err){
                throw err;
            }
        });
    } catch (error) {
        throw error;
    }
};

const create = function (db, contactId, userId, contactUserId, callback) {
    try {
        let sql = `
        INSERT INTO ${tableName} (
            ${columnContactId},
            ${columnUserId},
            ${columnContactUserId}
        ) VALUES (
            '${contactId}',
            '${userId}',
            '${contactUserId}'
        );`;
        db.run(sql, (err) => {
            callback(err)
        });
    } catch (error) {
        throw error;
    }
};

const subscribe = function (db, contactId, callback) {
    try{
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
    try{
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
    try{
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
    try{
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
    subscribe,
    unsubscribe,
    getById,
    getByUserId,
    deleteById
}