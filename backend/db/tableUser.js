const userStatus = {
    ENABLED: 'enabled',
    DISABLED: 'disabled'
};

const userType = {
    USER: 'user',
    ADMIN: 'admin',
    BUSSINESS: 'business'
}

const tableName = 'tableUser';
const columnUserId = 'id';
const columnCryptoPrivateKey = 'cryptoPrivateKey';
const columnSigningPrivateKey = 'signingPrivateKey';
const columnNumberOfMessages = 'numberOfMessages';
const columnNumberOfBlockedMessages = 'numberOfBlockedMessages';
const columnUserStatus = 'userStatus';
const columnLastSignOfLife = 'lastSignOfLife';
const columnSubscription = 'subscription';
const columnType = 'type';

const init = function (db) {
    try {
        const sql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
            ${columnUserId} TEXT PRIMARY KEY NOT NULL, 
            ${columnCryptoPrivateKey} TEXT NOT NULL,
            ${columnSigningPrivateKey} TEXT NOT NULL, 
            ${columnNumberOfMessages} INTEGER DEFAULT 0,
            ${columnNumberOfBlockedMessages} INTEGER DEFAULT 0,
            ${columnUserStatus} TEXT NOT NULL DEFAULT '${userStatus.ENABLED}',
            ${columnLastSignOfLife} INTEGER NOT NULL,
            ${columnSubscription} TEXT DEFAULT NULL,
            ${columnType} TEXT DEFAULT NULL
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

const create = function (db, userId, cryptoPrivateKey, signingPrivateKey, callback) {
    try {
        let sql = `
        INSERT INTO ${tableName} (
            ${columnUserId}, 
            ${columnCryptoPrivateKey},
            ${columnSigningPrivateKey},
            ${columnType},
            ${columnLastSignOfLife}
        ) 
        VALUES (
            '${userId}', 
            '${cryptoPrivateKey}',
            '${signingPrivateKey}',
            '${userType.USER}',
            datetime('now')
        );`;
        db.run(sql, (err) => {
            callback(err)
        });
    } catch (error) {
        throw error;
    }
};

const getAll = function (db, callback) {
    try {
        let sql = `SELECT * FROM ${tableName};`;

        db.all(sql, (err, rows) => {
            callback(err, rows);
        });
    } catch (error) {
        throw error;
    }
};

const getById = function (db, userId, callback) {
    try {
        let sql = `
        SELECT * FROM ${tableName}
        WHERE ${columnUserId} = ?;`;

        db.get(sql, [userId], (err, row) => {
            callback(err, row);
        });
    } catch (error) {
        throw error;
    }
};

const deleteById = function (db, userId, callback) {
    try {
        let sql = `
        DELETE FROM ${tableName}
        WHERE ${columnUserId} = ?;`;

        db.run(sql, [userId], (err) => {
            callback(err)
        });
    } catch (error) {
        throw error;
    }
};

const clean = function (db, callback) {
    try {
        let sql = `
        DELETE FROM ${tableName}
        WHERE ${columnLastSignOfLife} < datetime('now','-90 days');`;

        db.run(sql, (err) => {
            callback(err)
        });
    } catch (error) {
        throw error;
    }
};

const subscribe = function (db, userId, subscription, callback) {
    try {
        let sql = `
        UPDATE ${tableName}
        SET ${columnSubscription} = '${subscription}'
        WHERE ${columnUserId} = ?;`;

        db.run(sql, [userId], (err) => {
            callback(err);
        });
    } catch (error) {
        throw error;
    }
};

const unsubscribe = function (db, placeId, callback) {
    try {
        let sql = `
        UPDATE ${tableName}
        SET ${columnSubscription} = ''
        WHERE ${columnUserId} = ?;`;

        db.run(sql, [userId], (err) => {
            callback(err);
        });
    } catch (error) {
        throw error;
    }
};

module.exports = {
    userStatus,
    init,
    create,
    getAll,
    getById,
    deleteById,
    clean,
    subscribe,
    unsubscribe
}