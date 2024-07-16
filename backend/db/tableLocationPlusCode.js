const tableName = 'tableLocationPlusCode';

const columnLocationId = 'locationId';
const columnPlusCode = 'plusCode';

const init = function (db) {
    try {
        const sql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
            ${columnLocationId} TEXT NOT NULL,
            ${columnPlusCode} TEXT NOT NULL,
            PRIMARY KEY (${columnUserId}, ${columnPlusCode}),
            FOREIGN KEY (${columnLocationId}) 
            REFERENCES tableLocation (id) 
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

const create = function (db, locationId, plusCode, callback) {
    try {
        let sql = `
        INSERT INTO ${tableName} (
            ${columnLocationId},
            ${columnPlusCode}
        ) VALUES (
            '${locationId}',
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

const remove = function (db, locationId, plusCode, callback) {
    try {
        let sql = `
        DELETE FROM ${tableName}
        WHERE ${columnLocationId} = ?
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
    remove
}