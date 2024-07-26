const tableName = 'tablePlacePlusCode';

const columnPlaceId = 'placeId';
const columnPlusCode = 'plusCode';

const init = function (db) {
    try {
        const sql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
            ${columnPlaceId} INTEGER NOT NULL,
            ${columnPlusCode} TEXT NOT NULL,
            PRIMARY KEY (${columnPlaceId}, ${columnPlusCode}),
            FOREIGN KEY (${columnPlaceId}) 
            REFERENCES tablePlace (id) 
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

const create = function (db, placeId, plusCode, callback) {
    try {
        let sql = `
        INSERT INTO ${tableName} (
            ${columnPlaceId},
            ${columnPlusCode}
        ) VALUES (
            ${placeId},
            '${plusCode}'
        );`;
        db.run(sql, (err) => {
            callback(err)     
        });
    } catch (error) {
        throw error;
    }
};

const getByPlusCode = function (db, plusCode, callback) {
    try{
        let sql = `
        SELECT * FROM ${tableName}
        WHERE ${columnPlusCode} = ?;`;

        db.all(sql, [plusCode], (err, rows) => {
            callback(err, rows);
        });
    } catch (error) {
        throw error;
    }
};

const getByPlaceId = function (db, placeId, callback) {
    try{
        let sql = `
        SELECT * FROM ${tableName}
        WHERE ${columnPlaceId} = ?;`;

        db.all(sql, [placeId], (err, rows) => {
            callback(err, rows);
        });
    } catch (error) {
        throw error;
    }
};

const remove = function (db, locationId, plusCode, callback) {
    try {
        let sql = `
        DELETE FROM ${tableName}
        WHERE ${columnPlaceId} = ?
        AND ${columnPlusCode} = ?;`;

        db.run(sql, [locationId, plusCode], (err) => {
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
    getByPlusCode,
    getByPlaceId,
    remove
}