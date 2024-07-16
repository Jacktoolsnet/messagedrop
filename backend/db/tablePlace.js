const tableName = 'tablePlace';

const columnPlaceId = 'id';
const columnUserId = 'userId';
const columnName = 'name'; // Max. 64 charachters.
const columnSubscription = 'subscription';

const init = function (db) {
    try {
        const sql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
            ${columnPlaceId} INTEGER PRIMARY KEY NOT NULL, 
            ${columnUserId} INTEGER DEFAULT NULL,
            ${columnName} TEXT NOT NULL,
            ${columnSubscription} TEXT DEFAULT NULL,
            CONSTRAINT FK_USER_ID FOREIGN KEY (${columnUserId}) 
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

const create = function (db, userId, name, callback) {
    try {
        let sql = `
        INSERT INTO ${tableName} (
            ${columnUserId},
            ${columnName}
        ) VALUES (
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

const update = function (db, locationId, name, callback) {
    try{
        let sql = `
        UPDATE ${tableName}
        SET ${columnName} = '${name}'
        WHERE ${columnPlaceId} = ?;`;

        db.run(sql, [locationId], (err) => {
            callback(err);
        });
    } catch (error) {
        throw error;
    }
};

const subscribe = function (db, locationId, subscription, callback) {
    try{
        let sql = `
        UPDATE ${tableName}
        SET ${columnSubscription} = '${subscription}'
        WHERE ${columnPlaceId} = ?;`;

        db.run(sql, [locationId], (err) => {
            callback(err);
        });
    } catch (error) {
        throw error;
    }
};

const unsubscribe = function (db, locationId, callback) {
    try{
        let sql = `
        UPDATE ${tableName}
        SET ${columnSubscription} = NULL
        WHERE ${columnPlaceId} = ?;`;

        db.run(sql, [locationId], (err) => {
            callback(err);
        });
    } catch (error) {
        throw error;
    }
};

const getById = function (db, locationId, callback) {
    try{
        let sql = `
        SELECT * FROM ${tableName}
        WHERE ${columnPlaceId} = ?;`;

        db.get(sql, [locationId], (err, row) => {
            callback(err, row);
        });
    } catch (error) {
        throw error;
    }
};

const getByUserId = function (db, userId, callback) {
    try{
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

const deleteById = function (db, locationId, callback) {
    try {
        let sql = `
        DELETE FROM ${tableName}
        WHERE ${columnPlaceId} = ?;`;

        db.run(sql, [locationId], (err) => {
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
    subscribe,
    unsubscribe,
    getById,
    getByUserId,
    deleteById
}