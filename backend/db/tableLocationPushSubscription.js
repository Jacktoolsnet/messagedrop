
const tableName = 'tableLocationPushSubscription';

const columnUserId = 'userId';
const columnName = 'name';
const columnPlusCode = 'plusCode';
const columnEndpoint = 'endpoint';
const columnExpirationTime = 'expirationTime';
const columnApplicationServerKey = 'applicationServerKey';

const init = function (db) {
    try {
        const sql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
            ${columnUserId} TEXT NOT NULL,
            ${columnPlusCode} TEXT NOT NULL,
            ${columnName} TEXT NOT NULL,
            ${columnEndpoint} TEXT NOT NULL,
            ${columnExpirationTime} TEXT,
            ${columnApplicationServerKey} TEXT NOT NULL,
            PRIMARY KEY (${columnUserId}, ${columnPlusCode}),
            FOREIGN KEY (${columnUserId}) 
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

const subscribe = function (db, userId, plusCode, name, endpoint, expirationTime, applicationServerKey, callback) {
    try {
        let sql = `
        INSERT INTO ${tableName} (
            ${columnUserId}, 
            ${columnPlusCode},
            ${columnName},
            ${columnEndpoint},
            ${columnExpirationTime},
            ${columnApplicationServerKey},
        ) VALUES (
            '${userId}',
            '${plusCode}',
            '${name}',
            '${endpoint}',
            '${expirationTime}',
            '${applicationServerKey}'
        );`;
        db.run(sql, (err) => {
            callback(err)     
        });
    } catch (error) {
        throw error;
    }
};

const isUserSubscribedToLocation = function (db, userId, plusCode, callback) {
    try {
        let sql = `
        SELECT COUNT(ALL) AS subscribedByUser FROM ${tableName} 
        WHERE ${columnUserId} = ?
        AND  ${columnPlusCode} = ?;`;

        db.get(sql, [userId, plusCode], (err, row) => {
            callback(err, row);
        });
    } catch (error) {
        throw error;
    }
};

const unsubscribe = function (db, userId, plusCode, callback) {
    try {
        let sql = `
        DELETE FROM ${tableName}
        WHERE ${columnUserId} = '${userId}' AND ${columnPlusCode} = '${plusCode}';`;
        db.run(sql, (err) => {
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
        WHERE ${columnExpirationTime} < date('now');`;

        db.run(sql, (err) => {
            callback(err)
        });
    } catch (error) {
        throw error;
    }
};

module.exports = {
    init,
    subscribe,
    isUserSubscribedToLocation,
    unsubscribe,
    clean
}