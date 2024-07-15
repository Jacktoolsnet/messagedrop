
const tableName = 'tableLocationPushSubscription';

const columnUserId = 'userId';
const columnPlusCode = 'plusCode';
const columnEndpoint = 'endpoint';
const columnExpirationTime = 'expirationTime';
const columnP256dhs = 'p256dh';
const columnAuth = 'auth';

const init = function (db) {
    try {
        const sql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
            ${columnUserId} TEXT NOT NULL,
            ${columnPlusCode} TEXT NOT NULL,
            ${columnEndpoint} TEXT NOT NULL,
            ${columnExpirationTime} TEXT,
            ${columnP256dhs} TEXT NOT NULL,
            ${columnAuth} TEXT NOT NULL,
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

const subscribe = function (db, userId, plusCode, endpoint, expirationTime, p256dh, auth, callback) {
    try {
        let sql = `
        INSERT INTO ${tableName} (
            ${columnUserId}, 
            ${columnPlusCode},
            ${columnEndpoint},
            ${columnExpirationTime},
            ${columnP256dhs},
            ${columnAuth}
        ) VALUES (
            '${userId}',
            '${plusCode}',
            '${endpoint}',
            '${expirationTime}',
            '${p256dh}',
            '${auth}'
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