const messageType = {
    PUBLIC : 'public', // For Version 1.0 only public messages are possible 
    COMMENT: 'comment',
    PRIVATE : 'private', // A private message is decrypted and only readable for the user who created the message.
    FRIENDS : "friends", // A friends message is decrypted with the friends key and signed the the user key.
    BUSINESS: "business" // A business message is created by a company. There will be a messagedropBusiness App in the future.
};

const messageStatus = {
    ENABLED : 'enabled',
    DISABLED : 'disabled'
};

const tableName = 'tableMessage';

const columnMessageId = 'id';
const columnParentMessageId = 'parentId';
const columnMessageType = 'typ'; // Public, private, friend, comment
const columnMessageCreateDateTime = 'createDateTime';
const columnMessageDeleteDateTime = 'deleteDateTime'; // On creation the message has a lifetime of 30 Days
const columnLatitude = 'latitude';
const columnLongtitude = 'longitude';
const columnPlusCode = 'plusCode'; // https://maps.google.com/pluscodes/
const columnMessage = 'message'; // Max. 256 charachters.
const columnMarkerType = 'markerType'; // Default, Food, Funny...
const columnStyle = 'style'; 
const columnViews = 'views'; 
const columnLikes = 'likes'; // Each like add on day to the lifetime of the message.
const columnDislikes = 'dislikes'; // Each dislike reduce the liftime of the message by one day.
const columnStatus = 'status';
const columnUserId = 'userId';

const init = function (db) {
    try {
        const sql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
            ${columnMessageId} INTEGER PRIMARY KEY NOT NULL, 
            ${columnParentMessageId} INTEGER NOT NULL DEFAULT 0,
            ${columnMessageType} TEXT NOT NULL,
            ${columnMessageCreateDateTime} INTEGER NOT NULL, 
            ${columnMessageDeleteDateTime} INTEGER NOT NULL,
            ${columnLatitude} NUMBER NOT NULL,
            ${columnLongtitude} NUMBER NOT NULL,
            ${columnPlusCode} TEXT NOT NULL DEFAULT 'undefined',
            ${columnMessage} TEXT NOT NULL,
            ${columnMarkerType} TEXT NOT NULL DEFAULT 'default',
            ${columnStyle} TEXT NOT NULL DEFAULT '',
            ${columnViews} INTEGER NOT NULL DEFAULT 0,
            ${columnLikes} INTEGER NOT NULL DEFAULT 0,
            ${columnDislikes} INTEGER NOT NULL DEFAULT 0,
            ${columnStatus} TEXT NOT NULL DEFAULT '${messageStatus.ENABLED}',
            ${columnUserId} TEXT NOT NULL,
            FOREIGN KEY (${columnUserId}) 
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

const create = function (db, parentMessageId, messageTyp, latitude, longtitude, plusCode, message, markerType, style, userId, callback) {
    try {
        let sql = `
        INSERT INTO ${tableName} (
            ${columnParentMessageId},
            ${columnMessageType}, 
            ${columnMessageCreateDateTime},
            ${columnMessageDeleteDateTime},
            ${columnLatitude},
            ${columnLongtitude},
            ${columnPlusCode},
            ${columnMessage},
            ${columnMarkerType},
            ${columnStyle},
            ${columnUserId}
        ) VALUES (
            ${parentMessageId},
            '${messageTyp}', 
            datetime('now'),
            datetime('now', '+30 days'),
            ${latitude},
            ${longtitude},
            '${plusCode}',
            '${message}',
            '${markerType}',
            '${style}',
            '${userId}'
        );`;
        
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

const getById = function (db, messageId, callback) {
    try{
        let sql = `
        SELECT * FROM ${tableName}
        WHERE ${columnMessageId} = ?;`;

        db.get(sql, [messageId], (err, row) => {
            callback(err, row);
        });
    } catch (error) {
        throw error;
    }
};

const getByPlusCode = function (db, plusCode, callback) {
    try{
        let sql = `
        SELECT * FROM ${tableName}
        WHERE ${columnPlusCode} LIKE ?
        AND ${columnStatus} = '${messageStatus.ENABLED}'      
        ORDER BY ${columnMessageCreateDateTime} DESC;`;

        db.all(sql, [plusCode], (err, rows) => {
            callback(err, rows);
        });
    } catch (error) {
        throw error;
    }
};

const getByParentId = function (db, parentMessageId, callback) {
    try{
        let sql = `
        SELECT * FROM ${tableName}
        WHERE ${columnParentMessageId} = ?;`;

        db.all(sql, [parentMessageId], (err, rows) => {
            callback(err, rows);
        });
    } catch (error) {
        throw error;
    }
};

const countView = function (db, messageId, callback) {
    try{
        sql = `
        UPDATE ${tableName}
        SET ${columnViews} = ${columnViews} + 1
        WHERE ${columnMessageId} = ?;`

        db.run(sql, [messageId], (err) => {
            callback(err);
        });
    } catch (error) {
        throw error;
    }
};

const disableMessage = function (db, messageId, callback) {
    try{
        let sql = `
        UPDATE ${tableName}
        SET ${columnStatus} = '${messageStatus.DISABLED}' 
        WHERE ${columnMessageId} = ?;`;

        db.run(sql, [messageId], (err) => {
            callback(err);
        });
    } catch (error) {
        throw error;
    }
};

const enableMessage = function (db, messageId, callback) {
    try{
        let sql = `
        UPDATE ${tableName}
        SET ${columnStatus} = '${messageStatus.ENABLED}' 
        WHERE ${columnMessageId} = ?;`;

        db.run(sql, [messageId], (err) => {
            callback(err);
        });
    } catch (error) {
        throw error;
    }
};

const deleteById = function (db, messageId, callback) {
    try {
        let sql = `
        DELETE FROM ${tableName}
        WHERE ${columnMessageId} = ?;`;

        db.run(sql, [messageId], (err) => {
            if (err) {
                callback(err);
            } else {
                deleteComments(db, messageId);
                callback(err);
            }
        });
    } catch (error) {
        throw error;
    }
};

const deleteComments = function (db, parentMessageId) {
    try {
        let sql = `
        SELECT ${columnMessageId} FROM ${tableName}
        WHERE ${columnParentMessageId} = ?`; 

        db.each(sql, [parentMessageId], (err, row) => {
            sql = `
            DELETE FROM ${tableName}
            WHERE ${columnMessageId} = ?;`;

            db.run(sql, [row.messageId], (err) => {
                deleteComments(db, row.messageId);
            });
        });
    } catch (error) {
        throw error;
    }
};

const cleanPublic = function (db, callback) {
    try {
        let sql = `
        DELETE FROM ${tableName}
        WHERE ${columnMessageType} = '${messageType.PUBLIC}'
        AND ${columnMessageDeleteDateTime} < date('now');`;

        db.run(sql, (err) => {
            if (err) {
                callback(err);
            } else {
                sql = `
                DELETE FROM ${tableName}
                WHERE ${columnParentMessageId} <> 0 
                AND ${columnParentMessageId} NOT IN (
                    SELECT ${columnMessageId} FROM ${tableName}
                );`
                db.run(sql, (err) => {
                    callback(err);
                });
            }
        });
    } catch (error) {
        throw error;
    }
};

module.exports = {
    init,
    create,
    disableMessage,
    enableMessage,   
    getAll,
    getById,
    getByPlusCode,
    getByParentId,
    countView,
    deleteById,
    cleanPublic
}