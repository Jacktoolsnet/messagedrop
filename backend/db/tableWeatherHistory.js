const tableName = 'tableWeatherHistory';
const columnCacheKey = 'cacheKey';
const columnHistoryData = 'historyData';
const columnLastUpdate = 'lastUpdate';

const init = function (db) {
    const sql = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
        ${columnCacheKey} TEXT PRIMARY KEY,
        ${columnHistoryData} TEXT,
        ${columnLastUpdate} TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );`;
    db.run(sql);
};

const setHistoryData = function (db, cacheKey, historyData, callback) {
    const sql = `
    INSERT INTO ${tableName} (${columnCacheKey}, ${columnHistoryData}, ${columnLastUpdate})
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT (${columnCacheKey}) DO UPDATE SET
        ${columnHistoryData} = EXCLUDED.${columnHistoryData},
        ${columnLastUpdate} = CURRENT_TIMESTAMP;`;
    db.run(sql, [cacheKey, historyData], callback);
};

const getHistoryData = function (db, cacheKey, callback) {
    const sql = `SELECT * FROM ${tableName} WHERE ${columnCacheKey} = ?;`;
    db.get(sql, [cacheKey], callback);
};

const cleanExpired = function (db, callback) {
    const sql = `
        DELETE FROM ${tableName}
        WHERE ${columnLastUpdate} < CURRENT_TIMESTAMP - INTERVAL '1 month';
    `;
    db.run(sql, callback);
};

module.exports = {
    init,
    setHistoryData,
    getHistoryData,
    cleanExpired
};