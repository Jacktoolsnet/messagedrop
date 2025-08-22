const tableName = 'tablePlace';

const columnPlaceId = 'id';
const columnUserId = 'userId';
const columnName = 'name'; // Max. 64 charachters.
const columnSubscribed = 'subscribed';
const columnLatMin = 'latMin';
const columnLatMax = 'latMax';
const columnLonMin = 'lonMin';
const columnLonMax = 'lonMax';

const init = function (db) {
    try {
        const sql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
            ${columnPlaceId} TEXT PRIMARY KEY NOT NULL, 
            ${columnUserId} TEXT DEFAULT NULL,
            ${columnName} TEXT NOT NULL,
            ${columnSubscribed} BOOLEAN NOT NULL DEFAULT false,
            ${columnLatMin} REAL DEFAULT NULL,
            ${columnLatMax} REAL DEFAULT NULL,
            ${columnLonMin} REAL DEFAULT NULL,
            ${columnLonMax} REAL DEFAULT NULL,
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

const create = function (
    db,
    placeId,
    userId,
    name,
    latMin,
    latMax,
    lonMin,
    lonMax,
    callback
) {
    try {
        const sql = `
      INSERT INTO ${tableName} (
        ${columnPlaceId},
        ${columnUserId},
        ${columnName},
        ${columnLatMin},
        ${columnLatMax},
        ${columnLonMin},
        ${columnLonMax}
      ) VALUES (?, ?, ?, ?, ?, ?, ?);
    `;

        const params = [
            placeId,
            userId,
            (name ?? '').trim(),
            Number(latMin),
            Number(latMax),
            Number(lonMin),
            Number(lonMax),
        ];

        db.run(sql, params, function (err) {
            if (err) return callback(err);
        });
    } catch (error) {
        callback(error);
    }
};

const update = function (db, placeId, name, latMin, latMax, lonMin, lonMax, callback) {
    try {
        let sql = `
        UPDATE ${tableName}
        SET ${columnName} = '${name}',
            ${columnLatMin} = ${latMin},
            ${columnLatMax} = ${latMax},
            ${columnLonMin} = ${lonMin},
            ${columnLonMax} = ${lonMax}
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
                callback(null);
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
    subscribe,
    unsubscribe,
    getById,
    getByUserId,
    getByUserIdAndName,
    deleteById
}