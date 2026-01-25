const tableName = 'tableAirQuality';
const columnCacheKey = 'cacheKey';
const columnAirQualityData = 'airQualityData';
const columnLastUpdate = 'lastUpdate';

const init = function (db) {
    const sql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
            ${columnCacheKey} TEXT PRIMARY KEY,
            ${columnAirQualityData} TEXT,
            ${columnLastUpdate} DATETIME DEFAULT CURRENT_TIMESTAMP
        );`;
    db.exec(sql);
};

const setAirQualityData = function (db, cacheKey, airQualityData, callback) {
    const sql = `
        INSERT OR REPLACE INTO ${tableName} (${columnCacheKey}, ${columnAirQualityData}, ${columnLastUpdate})
        VALUES (?, ?, datetime('now'));`;
    try {
        db.prepare(sql).run(cacheKey, airQualityData);
        if (callback) callback(null);
    } catch (err) {
        if (callback) callback(err);
    }
};

const getAirQualityData = function (db, cacheKey, callback) {
    const sql = `SELECT * FROM ${tableName} WHERE ${columnCacheKey} = ?;`;
    try {
        const row = db.prepare(sql).get(cacheKey);
        if (!row) return callback(null, null);
        return callback(null, row);
    } catch (err) {
        return callback(err);
    }
};

const cleanExpired = function (db, callback) {
    const sql = `
        DELETE FROM ${tableName}
        WHERE DATE(${columnLastUpdate}) < DATE('now', '-1 day');
    `;
    try {
        db.prepare(sql).run();
        if (callback) callback(null);
    } catch (err) {
        if (callback) callback(err);
    }
};

module.exports = {
    init,
    setAirQualityData,
    getAirQualityData,
    cleanExpired
};
