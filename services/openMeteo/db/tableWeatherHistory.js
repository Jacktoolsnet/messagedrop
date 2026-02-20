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
    db.exec(sql);
};

const setHistoryData = function (db, cacheKey, historyData, callback) {
    const sql = `
        INSERT OR REPLACE INTO ${tableName} (${columnCacheKey}, ${columnHistoryData}, ${columnLastUpdate})
        VALUES (?, ?, datetime('now'));`;
    db.run(sql, [cacheKey, historyData], (err) => {
        if (callback) callback(err || null);
    });
};

const getHistoryData = function (db, cacheKey, callback) {
    const sql = `SELECT * FROM ${tableName} WHERE ${columnCacheKey} = ?;`;
    db.get(sql, [cacheKey], (err, row) => {
        if (err) return callback(err);
        if (!row) return callback(null, null);
        return callback(null, row);
    });
};

const cleanExpired = function (db, callback) {
    const sql = `
        DELETE FROM ${tableName}
        WHERE DATETIME(${columnLastUpdate}) < DATETIME('now', '-7 day');
    `;
    db.run(sql, [], (err) => {
        if (callback) callback(err || null);
    });
};

module.exports = {
    init,
    setHistoryData,
    getHistoryData,
    cleanExpired
};
