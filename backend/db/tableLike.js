
const tableName = 'tableLike';

const columnLikeMessageId = 'likeMessageId';
const columnLikeUserId = 'likeUserId';

const init = function (db) {
    try {
        const sql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
            ${columnLikeMessageId} INTEGER NOT NULL,
            ${columnLikeUserId} TEXT NOT NULL,
            PRIMARY KEY (${columnLikeMessageId}, ${columnLikeUserId}),
            FOREIGN KEY (${columnLikeMessageId}) 
            REFERENCES tableMessage (messageId) 
            ON UPDATE CASCADE ON DELETE CASCADE,
            FOREIGN KEY (${columnLikeUserId}) 
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

const like = function (db, messageId, userId, callback) {
    try {
        let sql = `
        INSERT INTO ${tableName} (
            ${columnLikeMessageId}, 
            ${columnLikeUserId}
        ) VALUES (
            ${messageId},
            '${userId}'
        );`;

        db.run(sql, (err) => {
            if (err) {
                callback(err)
            } else {
                sql = `
                UPDATE tableMessage 
                SET messageLikes = (
                    SELECT COUNT(ALL) FROM tableLike
                    WHERE ${columnLikeMessageId} = ${messageId}
                ) WHERE messageId = ${messageId};`
                db.run(sql, (err) => {
                    callback(err);
                });
            }            
        });
    } catch (error) {
        throw error;
    }
};

const unlike = function (db, messageId, userId, callback) {
    try {
        let sql = `
        DELETE FROM ${tableName}
        WHERE ${columnLikeMessageId} = ${messageId} AND ${columnLikeUserId} = '${userId}';`;

        db.run(sql, (err) => {
            if (err) {
                callback(err)
            } else {
                sql = `
                UPDATE tableMessage 
                SET messageLikes = (
                    SELECT COUNT(ALL) FROM tableLike
                    WHERE ${columnLikeMessageId} = ${messageId}
                ) WHERE messageId = ${messageId};`
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
    like,
    unlike
}