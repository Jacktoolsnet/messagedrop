const tableName = 'tableNominatimCache';
const columnCacheKey = 'cacheKey';
const columnNominatimPlace = 'nominatimPlace';
const columnLastUpdate = 'lastUpdate';

const init = function (db) {
    const sql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
            ${columnCacheKey} TEXT PRIMARY KEY,
            ${columnNominatimPlace} TEXT,
            ${columnLastUpdate} TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );`;
    db.exec(sql);
};

const setNominatimCache = function (db, cacheKey, nominatimPlaceJson, callback) {
    const sql = `
        INSERT INTO ${tableName}
        (${columnCacheKey}, ${columnNominatimPlace}, ${columnLastUpdate})
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT (${columnCacheKey}) DO UPDATE SET
            ${columnNominatimPlace} = EXCLUDED.${columnNominatimPlace},
            ${columnLastUpdate} = CURRENT_TIMESTAMP;`;
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
        WHERE ${columnLastUpdate} < CURRENT_TIMESTAMP - INTERVAL '3 months';
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
