const tableName = 'tableWeather';
const columnCacheKey = 'cacheKey';
const columnWeatherData = 'weatherData';
const columnLastUpdate = 'lastUpdate';

const init = function (db) {
    const sql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
            ${columnCacheKey} TEXT PRIMARY KEY,
            ${columnWeatherData} TEXT,
            ${columnLastUpdate} DATETIME DEFAULT CURRENT_TIMESTAMP
        );`;
    db.exec(sql);
};

const setWeatherData = function (db, cacheKey, weatherData, callback) {
    const sql = `
        INSERT OR REPLACE INTO ${tableName} (${columnCacheKey}, ${columnWeatherData}, ${columnLastUpdate})
        VALUES (?, ?, datetime('now'));`;
    try {
        db.prepare(sql).run(cacheKey, weatherData);
        if (callback) callback(null);
    } catch (err) {
        if (callback) callback(err);
    }
};

const getWeatherData = function (db, cacheKey, callback) {
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
        WHERE DATETIME(${columnLastUpdate}) < DATETIME('now', '-1 hour');
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
    setWeatherData,
    getWeatherData,
    cleanExpired
};
