const tableName = 'tablePlace';

const columnPlaceId = 'id';
const columnUserId = 'userId';
const columnName = 'name'; // Max. 64 charachters.
const columnSubscribed = 'subscribed';
const columnPlusCodes = 'plusCodes';

const init = function (db) {
    try {
        const sql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
            ${columnPlaceId} TEXT PRIMARY KEY NOT NULL, 
            ${columnUserId} TEXT DEFAULT NULL,
            ${columnName} TEXT NOT NULL,
            ${columnSubscribed} BOOLEAN NOT NULL DEFAULT false,
            ${columnPlusCodes} TEXT DEFAULT NULL,
            CONSTRAINT SECONDARY_KEY UNIQUE (${columnUserId}, ${columnName}),
            CONSTRAINT FK_USER_ID FOREIGN KEY (${columnUserId}) 
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

const create = function (db, placeId, userId, name, callback) {
    try {
        let sql = `
        INSERT INTO ${tableName} (
            ${columnPlaceId},
            ${columnUserId},
            ${columnName}
        ) VALUES (
            '${placeId}',
            '${userId}',
            '${name}'
        );`;
        db.run(sql, (err) => {
            callback(err)
        });
    } catch (error) {
        throw error;
    }
};

const update = function (db, placeId, name, callback) {
    try {
        let sql = `
        UPDATE ${tableName}
        SET ${columnName} = '${name}'
        WHERE ${columnPlaceId} = ?;`;

        db.run(sql, [placeId], (err) => {
            callback(err);
        });
    } catch (error) {
        throw error;
    }
};

const updatePlusCodes = function (db, placeId, plusCodes, callback) {
    try {
        let sql = `
        UPDATE ${tableName}
        SET ${columnPlusCodes} = '${plusCodes}'
        WHERE ${columnPlaceId} = ?;`;

        db.run(sql, [placeId], (err) => {
            callback(err);
        });
    } catch (error) {
        throw error;
    }
};

const subscribe = function (db, placeId, callback) {
    try {
        let sql = `
        UPDATE ${tableName}
        SET ${columnSubscribed} = true
        WHERE ${columnPlaceId} = ?;`;
        db.run(sql, [placeId], (err) => {
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
        SET ${columnSubscribed} = false
        WHERE ${columnPlaceId} = ?;`;

        db.run(sql, [placeId], (err) => {
            callback(err);
        });
    } catch (error) {
        throw error;
    }
};

const getById = function (db, placeId, callback) {
    try {
        let sql = `
        SELECT * FROM ${tableName}
        WHERE ${columnPlaceId} = ?;`;

        db.get(sql, [placeId], (err, row) => {
            callback(err, row);
        });
    } catch (error) {
        throw error;
    }
};

const getByUserIdAndName = function (db, userId, name, callback) {
    try {
        let sql = `
        SELECT * FROM ${tableName}
        WHERE ${columnUserId} = ?
        AND ${columnName} = ?;`;

        db.get(sql, [userId, name], (err, row) => {
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
        ORDER BY ${columnName} ASC;`;

        db.all(sql, [userId], (err, rows) => {
            callback(err, rows);
        });
    } catch (error) {
        throw error;
    }
};

const deleteById = function (db, placeId, callback) {
    try {
        let sql = `
        DELETE FROM ${tableName}
        WHERE ${columnPlaceId} = ?;`;

        db.run(sql, [placeId], (err) => {
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
    update,
    updatePlusCodes,
    subscribe,
    unsubscribe,
    getById,
    getByUserId,
    getByUserIdAndName,
    deleteById
}