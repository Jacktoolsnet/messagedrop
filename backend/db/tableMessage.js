const messageType = {
    PUBLIC: 'public', // For Version 1.0 only public messages are possible 
    COMMENT: 'comment',
    PRIVATE: 'private', // A private message is decrypted and only readable for the user who created the message.
    FRIENDS: "friends", // A friends message is decrypted with the friends key and signed the the user key.
    BUSINESS: "business" // A business message is created by a company. There will be a messagedropBusiness App in the future.
};

const messageStatus = {
    ENABLED: 'enabled',
    DISABLED: 'disabled'
};

const tableName = 'tableMessage';

const columnMessageId = 'id';
const columnUuid = 'uuid';
const columnParentUuid = 'parentUuid';
const columnMessageType = 'typ'; // Public, private, friend, comment
const columnMessageCreateDateTime = 'createDateTime';
const columnMessageDeleteDateTime = 'deleteDateTime'; // On creation the message has a lifetime of 30 Days
const columnLatitude = 'latitude';
const columnLongitude = 'longitude';
const columnPlusCode = 'plusCode'; // https://maps.google.com/pluscodes/
const columnMessage = 'message'; // Max. 256 charachters.
const columnMarkerType = 'markerType'; // Default, Food, Funny...
const columnStyle = 'style';
const columnViews = 'views';
const columnLikes = 'likes'; // Each like add on day to the lifetime of the message.
const columnDislikes = 'dislikes'; // Each dislike reduce the liftime of the message by one day.
const columnCommentsNumber = 'commentsNumber';
const columnStatus = 'status';
const columnUserId = 'userId';
const columnMultimedia = 'multimedia';

const init = function (db) {
    try {
        const sql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
            ${columnMessageId} INTEGER PRIMARY KEY NOT NULL,
            ${columnUuid} TEXT NOT NULL UNIQUE,
            ${columnParentUuid} TEXT DEFAUTL NULL,
            ${columnMessageType} TEXT NOT NULL,
            ${columnMessageCreateDateTime} INTEGER NOT NULL, 
            ${columnMessageDeleteDateTime} INTEGER NOT NULL,
            ${columnLatitude} NUMBER NOT NULL,
            ${columnLongitude} NUMBER NOT NULL,
            ${columnPlusCode} TEXT NOT NULL DEFAULT 'undefined',
            ${columnMessage} TEXT NOT NULL,
            ${columnMarkerType} TEXT NOT NULL DEFAULT 'default',
            ${columnStyle} TEXT NOT NULL DEFAULT '',
            ${columnViews} INTEGER NOT NULL DEFAULT 0,
            ${columnLikes} INTEGER NOT NULL DEFAULT 0,
            ${columnDislikes} INTEGER NOT NULL DEFAULT 0,
            ${columnCommentsNumber} INTEGER NOT NULL DEFAULT 0,
            ${columnStatus} TEXT NOT NULL DEFAULT '${messageStatus.ENABLED}',
            ${columnUserId} TEXT NOT NULL,
            ${columnMultimedia} TEXT DEFAULT NULL,
            CONSTRAINT FK_USER_ID FOREIGN KEY (${columnUserId}) 
            REFERENCES tableUser (id) 
            ON UPDATE CASCADE ON DELETE CASCADE,
            CONSTRAINT FK_PARENT FOREIGN KEY (${columnParentUuid})
            REFERENCES ${tableName} (${columnUuid})
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

const create = function (db, uuid, parentUuid, messageTyp, latitude, longitude, plusCode, message, markerType, style, userId, multimedia, callback) {
    try {
        const insertSql = `
        INSERT INTO ${tableName} (
            ${columnUuid},
            ${columnParentUuid},
            ${columnMessageType}, 
            ${columnMessageCreateDateTime},
            ${columnMessageDeleteDateTime},
            ${columnLatitude},
            ${columnLongitude},
            ${columnPlusCode},
            ${columnMessage},
            ${columnMarkerType},
            ${columnStyle},
            ${columnUserId},
            ${columnMultimedia}
        ) VALUES (
            '${uuid}',
            ${parentUuid === '' ? null : "'" + parentUuid + "'"},
            '${messageTyp}', 
            datetime('now'),
            datetime('now', '+30 days'),
            ${latitude},
            ${longitude},
            '${plusCode}',
            '${message}',
            '${markerType}',
            '${style}',
            '${userId}',
            '${multimedia}'
        );`;
        db.run(insertSql, (err) => {
            if (err) {
                callback(err);
                return;
            }

            if (parentUuid !== null) {
                const updateSql = `
                    UPDATE ${tableName}
                    SET ${columnCommentsNumber} = ${columnCommentsNumber} + 1
                    WHERE ${columnUuid} = '${parentUuid}';
                `;
                db.run(updateSql, (updateErr) => {
                    callback(updateErr);
                });
            } else {
                callback(null);
            }
        });
    } catch (error) {
        throw error;
    }
};

const update = function (db, messageId, message, style, multimedia, callback) {
    try {
        let sql = `
        UPDATE ${tableName}
        SET ${columnMessage} = '${message}', 
            ${columnStyle} = '${style}',
            ${columnMultimedia} = '${multimedia}' 
        WHERE ${columnMessageId} = ?;`;

        db.run(sql, [messageId], (err) => {
            callback(err);
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

const getById = function (db, messageId, callback) {
    try {
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

const getByUserId = function (db, userId, callback) {
    try {
        let sql = `
        SELECT * FROM ${tableName}
        WHERE ${columnUserId} = ?
        ORDER BY ${columnMessageCreateDateTime} DESC;`;

        db.all(sql, [userId], (err, rows) => {
            callback(err, rows);
        });
    } catch (error) {
        throw error;
    }
};

const getByPlusCode = function (db, plusCode, callback) {
    try {
        let sql = `
        SELECT * FROM ${tableName}
        WHERE ${columnPlusCode} LIKE ?
        AND ${columnParentUuid} IS NULL
        AND ${columnStatus} = '${messageStatus.ENABLED}'      
        ORDER BY ${columnMessageCreateDateTime} DESC;`;

        db.all(sql, [plusCode], (err, rows) => {
            callback(err, rows);
        });
    } catch (error) {
        throw error;
    }
};

const getByParentUuid = function (db, parentUuid, callback) {
    try {
        let sql = `
        SELECT * FROM ${tableName}
        WHERE ${columnParentUuid} = ?
        AND ${columnStatus} = '${messageStatus.ENABLED}'
        ORDER BY ${columnMessageCreateDateTime} ASC;`;

        db.all(sql, [parentUuid], (err, rows) => {
            callback(err, rows);
        });
    } catch (error) {
        throw error;
    }
};

const countView = function (db, parentMessageId, callback) {
    try {
        sql = `
        UPDATE ${tableName}
        SET ${columnViews} = ${columnViews} + 1
        WHERE ${columnMessageId} = ?;`

        db.run(sql, [parentMessageId], (err) => {
            callback(err);
        });
    } catch (error) {
        throw error;
    }
};

const countComment = function (db, messageId, callback) {
    try {
        sql = `
        UPDATE ${tableName}
        SET ${columnCommentsNumber} = ${columnCommentsNumber} + 1
        WHERE ${columnMessageId} = ?;`

        db.run(sql, [messageId], (err) => {
            callback(err);
        });
    } catch (error) {
        throw error;
    }
};

const disableMessage = function (db, messageId, callback) {
    try {
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
    try {
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
        // Zuerst den Parent ermitteln
        const selectSql = `
            SELECT ${columnParentUuid}
            FROM ${tableName}
            WHERE ${columnMessageId} = ?;`;

        db.get(selectSql, [messageId], (err, row) => {
            if (err) {
                callback(err);
                return;
            }

            const parentUuid = row ? row[columnParentUuid] : null;

            // Danach den eigentlichen Delete ausführen
            const deleteSql = `
                DELETE FROM ${tableName}
                WHERE ${columnMessageId} = ?;`;

            db.run(deleteSql, [messageId], (deleteErr) => {
                if (deleteErr) {
                    callback(deleteErr);
                    return;
                }

                // Wenn es einen Parent gibt → Zähler reduzieren
                if (parentUuid) {
                    const updateSql = `
                        UPDATE ${tableName}
                        SET ${columnCommentsNumber} = MAX(${columnCommentsNumber} - 1, 0)
                        WHERE ${columnUuid} = ?;`;

                    db.run(updateSql, [parentUuid], (updateErr) => {
                        callback(updateErr);
                    });
                } else {
                    callback(null); // Kein Parent, fertig
                }
            });
        });
    } catch (error) {
        throw error;
    }
};

const cleanPublic = function (db, callback) {
    console.log('cleanPublic');
    try {
        const selectSql = `
            SELECT ${columnParentUuid} AS parentUuid, COUNT(*) AS count
            FROM ${tableName}
            WHERE ${columnMessageType} = '${messageType.PUBLIC}'
            AND DATETIME(${columnMessageDeleteDateTime}) < DATETIME('now')
            AND ${columnParentUuid} IS NOT NULL
            GROUP BY ${columnParentUuid};
        `;
        db.all(selectSql, [], (err, rows) => {
            if (err) {
                return callback(err);
            }

            const updatePromises = rows.map(row => {
                return new Promise((resolve, reject) => {
                    const updateSql = `
                        UPDATE ${tableName}
                        SET ${columnCommentsNumber} = MAX(${columnCommentsNumber} - ?, 0)
                        WHERE ${columnUuid} = ?;
                    `;
                    db.run(updateSql, [row.count, row.parentUuid], function (updateErr) {
                        if (updateErr) return reject(updateErr);
                        resolve();
                    });
                });
            });

            Promise.all(updatePromises)
                .then(() => {
                    const deleteSql = `
                        DELETE FROM ${tableName}
                        WHERE ${columnMessageType} = '${messageType.PUBLIC}'
                        AND DATETIME(${columnMessageDeleteDateTime}) < DATETIME('now');
                    `;
                    db.run(deleteSql, (deleteErr) => {
                        if (deleteErr) {
                            return callback(deleteErr);
                        }
                        callback(null);
                    });
                })
                .catch(err => callback(err));
        });
    } catch (error) {
        callback(error);
    }
};

module.exports = {
    init,
    create,
    update,
    disableMessage,
    enableMessage,
    getAll,
    getById,
    getByUserId,
    getByPlusCode,
    getByParentUuid,
    countView,
    countComment,
    deleteById,
    cleanPublic
}