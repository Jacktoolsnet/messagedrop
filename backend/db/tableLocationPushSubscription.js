
const tableName = 'tableLocationPushSubscription';

const columnUserId = 'userId';
const columnPlusCode = 'plusCode';
const columnName = 'name';
const columnSubscription = 'subscription';

const init = function (db) {
    try {
        const sql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
            ${columnUserId} TEXT NOT NULL,
            ${columnPlusCode} TEXT NOT NULL,
            ${columnName} TEXT NOT NULL,
            ${columnSubscription} TEXT NOT NULL,
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

const subscribe = function (db, userId, plusCode, name, subscription, callback) {
    try {
        let sql = `
        INSERT INTO ${tableName} (
            ${columnUserId}, 
            ${columnPlusCode},
            ${columnName},
            ${columnSubscription}
        ) VALUES (
            '${userId}',
            '${plusCode}',
            '${name}',
            '${subscription}'
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