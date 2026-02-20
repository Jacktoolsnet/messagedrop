const tableName = 'tableNominatimCache';
const columnCacheKey = 'cacheKey';
const columnNominatimPlace = 'nominatimPlace';
const columnLastUpdate = 'lastUpdate';

const init = function (db) {
    const sql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
            ${columnCacheKey} TEXT PRIMARY KEY,
            ${columnNominatimPlace} TEXT,
            ${columnLastUpdate} DATETIME DEFAULT CURRENT_TIMESTAMP
        );`;
    db.exec(sql);
};

const setNominatimCache = function (db, cacheKey, nominatimPlaceJson, callback) {
    const sql = `
        INSERT OR REPLACE INTO ${tableName}
        (${columnCacheKey}, ${columnNominatimPlace}, ${columnLastUpdate})
        VALUES (?, ?, datetime('now'));`;
    db.run(sql, [cacheKey, nominatimPlaceJson], (error) => {
        if (callback) callback(error || null);
    });
};

const getNominatimCache = function (db, cacheKey, callback) {
    const sql = `SELECT * FROM ${tableName} WHERE ${columnCacheKey} = ?;`;
    db.get(sql, [cacheKey], (error, row) => {
        if (error) {
            if (callback) {
                callback(error);
            }
            return;
        }
        if (callback) {
            callback(null, row ?? null);
        }
    });
};

const cleanExpired = function (db, callback) {
    const sql = `
        DELETE FROM ${tableName}
        WHERE DATETIME(${columnLastUpdate}) < DATETIME('now', '-3 month');
    `;
    db.run(sql, [], (error) => {
        if (callback) callback(error || null);
    });
};

module.exports = {
    init,
    setNominatimCache,
    getNominatimCache,
    cleanExpired
};
