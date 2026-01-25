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
    try {
        db.prepare(sql).run(cacheKey, historyData);
        if (callback) callback(null);
    } catch (err) {
        if (callback) callback(err);
    }
};

const getHistoryData = function (db, cacheKey, callback) {
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
        WHERE DATETIME(${columnLastUpdate}) < DATETIME('now', '-7 day');
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
    setHistoryData,
    getHistoryData,
    cleanExpired
};
