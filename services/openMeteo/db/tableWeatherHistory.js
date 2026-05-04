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
    db.exec(sql);
};

const setHistoryData = function (db, cacheKey, historyData, callback) {
    const sql = `
        INSERT INTO ${tableName} (${columnCacheKey}, ${columnHistoryData}, ${columnLastUpdate})
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT (${columnCacheKey}) DO UPDATE SET
            ${columnHistoryData} = EXCLUDED.${columnHistoryData},
            ${columnLastUpdate} = CURRENT_TIMESTAMP;`;
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
        WHERE ${columnLastUpdate} < CURRENT_TIMESTAMP - INTERVAL '7 days';
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
