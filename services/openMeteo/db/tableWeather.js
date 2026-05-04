const tableName = 'tableWeather';
const columnCacheKey = 'cacheKey';
const columnWeatherData = 'weatherData';
const columnLastUpdate = 'lastUpdate';

const init = function (db) {
    const sql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
            ${columnCacheKey} TEXT PRIMARY KEY,
            ${columnWeatherData} TEXT,
            ${columnLastUpdate} TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );`;
    db.exec(sql);
};

const setWeatherData = function (db, cacheKey, weatherData, callback) {
    const sql = `
        INSERT INTO ${tableName} (${columnCacheKey}, ${columnWeatherData}, ${columnLastUpdate})
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT (${columnCacheKey}) DO UPDATE SET
            ${columnWeatherData} = EXCLUDED.${columnWeatherData},
            ${columnLastUpdate} = CURRENT_TIMESTAMP;`;
    db.run(sql, [cacheKey, weatherData], (err) => {
        if (callback) callback(err || null);
    });
};

const getWeatherData = function (db, cacheKey, callback) {
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
        WHERE ${columnLastUpdate} < CURRENT_TIMESTAMP - INTERVAL '1 hour';
    `;
    db.run(sql, [], (err) => {
        if (callback) callback(err || null);
    });
};

module.exports = {
    init,
    setWeatherData,
    getWeatherData,
    cleanExpired
};
