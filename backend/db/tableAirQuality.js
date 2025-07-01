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
    db.run(sql);
};

const setAirQualityData = function (db, cacheKey, airQualityData, callback) {
    const sql = `
        INSERT OR REPLACE INTO ${tableName} (${columnCacheKey}, ${columnAirQualityData}, ${columnLastUpdate})
        VALUES (?, ?, datetime('now'));`;
    db.run(sql, [cacheKey, airQualityData], callback);
};

const getAirQualityData = function (db, cacheKey, callback) {
    const sql = `SELECT * FROM ${tableName} WHERE ${columnCacheKey} = ?;`;
    db.get(sql, [cacheKey], callback);
};

const cleanExpired = function (db, callback) {
    const sql = `
        DELETE FROM ${tableName}
        WHERE DATE(${columnLastUpdate}) < DATE('now', '-1 day');
    `;
    db.run(sql, callback);
};

module.exports = {
    init,
    setAirQualityData,
    getAirQualityData,
    cleanExpired
};