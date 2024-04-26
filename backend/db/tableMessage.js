/*
statisticDate: One record per date.
visitors: Visitors per day.
messages: Messages per day.
*/

const messageType = {
    PUBLIC : 'public', // For Version 1.0 only public messages are possible 
    PRIVATE : 'private', // A private message is decrypted and only readable for the user who created the message.
    FRIENDS : "friends", // A friends message is decrypted with the friends key and signed the the user key.
    BUSINESS: "business" // A business message is created by a company. There will be a messagedropBusiness App in the future.
};

const messageStatus = {
    ENABLED : 'enabled',
    DISABLED : 'disabled'
};

const tableName = 'tableMessage';

const columnMessageId = 'messageId';
const columnMessageType = 'messageTyp';
const columnMessageCreateDateTime = 'messageCreateDateTime';
const columnMessageDeleteDateTime = 'messageDeleteDateTime'; // On creation the message has a lifetime of 30 Days
const columnLatitude = 'latitude';
const columnLongitude = 'longitude';
const columnPlusCode = 'plusCode';
const columnMessage = 'message'; // Max. 256 charachters.
const columnMessageViews = 'messageViews'; 
const columnMessageLikes = 'messageLikes'; // Each like add on day to the lifetime of the message.
const columnMessageDislikes = 'messageDislikes'; // Each dislike reduce the liftime of the message by one day.
const columnMessageStatus = 'messageStatus';
const columnMessageUserId = 'messageUserId';

const init = function (db) {
    try {
        const sql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
            ${columnMessageId} INTEGER PRIMARY KEY NOT NULL, 
            ${columnMessageType} TEXT NOT NULL,
            ${columnMessageCreateDateTime} INTEGER NOT NULL, 
            ${columnMessageDeleteDateTime} INTEGER NOT NULL,
            ${columnLatitude} REAL NOT NULL,
            ${columnLongitude} REAL NOT NULL,
            ${columnPlusCode} TEXT NOT NULL,
            ${columnMessage} TEXT NOT NULL,
            ${columnMessageViews} INTEGER NOT NULL,
            ${columnMessageLikes} INTEGER NOT NULL,
            ${columnMessageDislikes} INTEGER NOT NULL,
            ${columnMessageStatus} TEXT NOT NULL,
            ${columnMessageUserId} TEXT NOT NULL,
            FOREIGN KEY (${columnMessageUserId}) 
            REFERENCES tableUser (userId) 
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

const countVisitor = function (db, callback) {
    try {
        let sql = `
        INSERT INTO ${tableName} (${columnStatisticDate}, ${columnVisitors}) 
        VALUES (date('now'), 1)
        ON CONFLICT(${columnStatisticDate}) DO UPDATE SET ${columnVisitors} = ${columnVisitors} + 1;`;

        db.run(sql, (err) => {
            callback(err)
        });
    } catch (error) {
        throw error;
    }
};

const countMessage = function (db, callback) {
    try {
        let sql = `
        INSERT INTO ${tableName} (${columnStatisticDate}, ${columnMessages}) 
        VALUES (date('now'), 1)
        ON CONFLICT(${columnStatisticDate}) DO UPDATE SET ${columnMessages} = ${columnMessages} + 1;`;

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
        WHERE ${columnStatisticDate} < datetime('now','-90 days');`;

        db.run(sql, (err) => {
            callback(err)
        });
    } catch (error) {
        throw error;
    }
};

const getAll = function (db, callback) {
    try{
        let sql = `SELECT * FROM ${tableName};`;

        db.all(sql, (err, rows) => {
            callback(err, rows);
        });
    } catch (error) {
        throw error;
    }
};

module.exports = {
    init,
    clean,
    countVisitor,
    countMessage,
    getAll
}