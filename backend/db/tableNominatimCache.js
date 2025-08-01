const tableName = 'tableNominatimCache';
const columnCacheKey = 'cacheKey';
const columnNominatimPlace = 'nominatimPlace';
const columnLastUpdate = 'lastUpdate';

const init = function (db) {
    try {
        const sql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
            ${columnCacheKey} TEXT PRIMARY KEY,
            ${columnNominatimPlace} TEXT,
            ${columnLastUpdate} DATETIME DEFAULT CURRENT_TIMESTAMP
        );`;
        db.run(sql, (err) => {
            if (err) throw err;
        });
    } catch (error) {
        throw error;
    }
};

const setNominatimCache = function (db, cacheKey, nominatimPlaceJson, callback) {
    try {
        const sql = `
        INSERT OR REPLACE INTO ${tableName}
        (${columnCacheKey}, ${columnNominatimPlace}, ${columnLastUpdate})
        VALUES (?, ?, datetime('now'));`;
        db.run(sql, [cacheKey, nominatimPlaceJson], (err) => {
            callback(err);
        });
    } catch (error) {
        throw error;
    }
};

const getNominatimCache = function (db, cacheKey, callback) {
    try {
        const sql = `SELECT * FROM ${tableName} WHERE ${columnCacheKey} = ?;`;
        db.get(sql, [cacheKey], (err, row) => {
            callback(err, row);
        });
    } catch (error) {
        throw error;
    }
};

const cleanExpired = function (db, callback) {
    const sql = `
        DELETE FROM ${tableName}
        WHERE DATETIME(${columnLastUpdate}) < DATETIME('now', '-3 month');
    `;
    db.run(sql, callback);
};

module.exports = {
    init,
    setNominatimCache,
    getNominatimCache,
    cleanExpired
};
