const tableName = 'tableWeatherHistory';
const columnCacheKey = 'cacheKey';
const columnHistoryData = 'historyData';
const columnLastUpdate = 'lastUpdate';

const init = function (db) {
    const sql = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
        ${columnCacheKey} TEXT PRIMARY KEY,
        ${columnHistoryData} TEXT,
        ${columnLastUpdate} DATETIME DEFAULT CURRENT_TIMESTAMP
    );`;
    db.run(sql);
};

const setHistoryData = function (db, cacheKey, historyData, callback) {
    const sql = `
    INSERT OR REPLACE INTO ${tableName} (${columnCacheKey}, ${columnHistoryData}, ${columnLastUpdate})
    VALUES (?, ?, datetime('now'));`;
    db.run(sql, [cacheKey, historyData], callback);
};

const getHistoryData = function (db, cacheKey, callback) {
    const sql = `SELECT * FROM ${tableName} WHERE ${columnCacheKey} = ?;`;
    db.get(sql, [cacheKey], callback);
};

const cleanExpired = function (db, callback) {
    const sql = `
        DELETE FROM ${tableName}
        WHERE DATETIME(${columnLastUpdate}) < DATETIME('now', '-1 month');
    `;
    db.run(sql, callback);
};

module.exports = {
    init,
    setHistoryData,
    getHistoryData,
    cleanExpired
};