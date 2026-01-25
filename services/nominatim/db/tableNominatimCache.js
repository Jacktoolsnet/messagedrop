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
        db.exec(sql);
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
        db.prepare(sql).run(cacheKey, nominatimPlaceJson);
        if (callback) callback(null);
    } catch (error) {
        if (callback) return callback(error);
        throw error;
    }
};

const getNominatimCache = function (db, cacheKey, callback) {
    try {
        const sql = `SELECT * FROM ${tableName} WHERE ${columnCacheKey} = ?;`;
        const row = db.prepare(sql).get(cacheKey);
        callback(null, row ?? null);
    } catch (error) {
        if (callback) return callback(error);
        throw error;
    }
};

const cleanExpired = function (db, callback) {
    const sql = `
        DELETE FROM ${tableName}
        WHERE DATETIME(${columnLastUpdate}) < DATETIME('now', '-3 month');
    `;
    try {
        db.prepare(sql).run();
        if (callback) callback(null);
    } catch (error) {
        if (callback) return callback(error);
        throw error;
    }
};

module.exports = {
    init,
    setNominatimCache,
    getNominatimCache,
    cleanExpired
};
