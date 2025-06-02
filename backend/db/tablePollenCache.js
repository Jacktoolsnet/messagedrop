const tableName = 'tablePollenCache';
const columnCacheKey = 'cacheKey';
const columnPollenData = 'pollenData';
const columnLastUpdate = 'lastUpdate';

const init = function (db) {
    const sql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
            ${columnCacheKey} TEXT PRIMARY KEY,
            ${columnPollenData} TEXT,
            ${columnLastUpdate} DATETIME DEFAULT CURRENT_TIMESTAMP
        );`;
    db.run(sql);
};

const setPollenData = function (db, cacheKey, pollenData, callback) {
    const sql = `
        INSERT OR REPLACE INTO ${tableName} (${columnCacheKey}, ${columnPollenData}, ${columnLastUpdate})
        VALUES (?, ?, datetime('now'));`;
    db.run(sql, [cacheKey, pollenData], callback);
};

const getPollenData = function (db, cacheKey, callback) {
    const sql = `SELECT * FROM ${tableName} WHERE ${columnCacheKey} = ?;`;
    db.get(sql, [cacheKey], callback);
};

const cleanExpired = function (db, callback) {
    const sql = `
        DELETE FROM ${tableName}
        WHERE ${columnLastUpdate} < DATETIME('now', '-1 day');
    `;
    db.run(sql, callback);
};

module.exports = {
    init,
    setPollenData,
    getPollenData,
    cleanExpired
};