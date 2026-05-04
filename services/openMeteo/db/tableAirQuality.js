const tableName = 'tableAirQuality';
const columnCacheKey = 'cacheKey';
const columnAirQualityData = 'airQualityData';
const columnLastUpdate = 'lastUpdate';

const init = function (db) {
    const sql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
            ${columnCacheKey} TEXT PRIMARY KEY,
            ${columnAirQualityData} TEXT,
            ${columnLastUpdate} TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );`;
    db.exec(sql);
};

const setAirQualityData = function (db, cacheKey, airQualityData, callback) {
    const sql = `
        INSERT INTO ${tableName} (${columnCacheKey}, ${columnAirQualityData}, ${columnLastUpdate})
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT (${columnCacheKey}) DO UPDATE SET
            ${columnAirQualityData} = EXCLUDED.${columnAirQualityData},
            ${columnLastUpdate} = CURRENT_TIMESTAMP;`;
    db.run(sql, [cacheKey, airQualityData], (err) => {
        if (callback) callback(err || null);
    });
};

const getAirQualityData = function (db, cacheKey, callback) {
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
        WHERE ${columnLastUpdate} < CURRENT_TIMESTAMP - INTERVAL '1 day';
    `;
    db.run(sql, [], (err) => {
        if (callback) callback(err || null);
    });
};

module.exports = {
    init,
    setAirQualityData,
    getAirQualityData,
    cleanExpired
};
