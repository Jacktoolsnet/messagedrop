
const tableName = 'tableDislike';

const columnDislikeMessageId = 'dislikeMessageId';
const columnDislikeUserId = 'dislikeUserId';

const init = function (db) {
    try {
        const sql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
            ${columnDislikeMessageId} INTEGER NOT NULL,
            ${columnDislikeUserId} TEXT NOT NULL,
            PRIMARY KEY (${columnDislikeMessageId}, ${columnDislikeUserId}),
            FOREIGN KEY (${columnDislikeMessageId}) 
            REFERENCES tableMessage (id) 
            ON UPDATE CASCADE ON DELETE CASCADE,
            FOREIGN KEY (${columnDislikeUserId}) 
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

const dislike = function (db, messageId, userId, callback) {
    try {
        let sql = `
        INSERT INTO ${tableName} (
            ${columnDislikeMessageId}, 
            ${columnDislikeUserId}
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
                SET dislikes = (
                    SELECT COUNT(ALL) FROM tableDislike
                    WHERE ${columnDislikeMessageId} = ${messageId}
                ) WHERE id = ${messageId};`
                db.run(sql, (err) => {
                    callback(err);
                });
            }
        });
    } catch (error) {
        throw error;
    }
};

const dislikedByUser = function (db, messageId, userId, callback) {
    try {
        let sql = `
        SELECT COUNT(ALL) AS dislikedByUser FROM ${tableName} 
        WHERE ${columnDislikeMessageId} = ?
        AND  ${columnDislikeUserId} = ?;`;

        db.get(sql, [messageId, userId], (err, row) => {
            callback(err, row);
        });
    } catch (error) {
        throw error;
    }
};

const undislike = function (db, messageId, userId, callback) {
    try {
        let sql = `
        DELETE FROM ${tableName}
        WHERE ${columnDislikeMessageId} = ${messageId} AND ${columnDislikeUserId} = '${userId}';`;
        db.run(sql, (err) => {
            if (err) {
                callback(err)
            } else {
                sql = `
                UPDATE tableMessage 
                SET dislikes = (
                    SELECT COUNT(ALL) FROM tableDislike
                    WHERE ${columnDislikeMessageId} = ${messageId}
                ) WHERE id = ${messageId};`
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
    dislike,
    dislikedByUser,
    undislike
}