const tableName = 'tableGeoStatistic';

const columnCountryCode = 'countryCode';
const columnCountryData = 'countryData';
const columnWorldbankData = 'worldbankData';
const columnLastUpdate = 'lastUpdate';

const init = function (db) {
    try {
        const sql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
            ${columnCountryCode} TEXT PRIMARY KEY, 
            ${columnCountryData} TEXT, 
            ${columnWorldbankData} TEXT,
            ${columnLastUpdate} TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );`;

        db.run(sql, (err) => {
            if (err) {
                throw err;
            }
        });
    } catch (error) {
        throw error;
    }
};

const setCountryData = function (db, countryCode, countryData, worldBankData, callback) {
    try {
        let sql = `
        INSERT INTO ${tableName} (${columnCountryCode}, ${columnCountryData}, ${columnWorldbankData}, ${columnLastUpdate})
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT (${columnCountryCode}) DO UPDATE SET
            ${columnCountryData} = EXCLUDED.${columnCountryData},
            ${columnWorldbankData} = EXCLUDED.${columnWorldbankData},
            ${columnLastUpdate} = CURRENT_TIMESTAMP;`;

        db.run(sql, [
            countryCode,
            countryData,
            worldBankData
        ], (err) => {
            callback(err)
        });
    } catch (error) {
        throw error;
    }
};

const getCountryData = function (db, countryCode, callback) {
    try {
        let sql = `SELECT * FROM ${tableName} WHERE ${columnCountryCode} = ?;`;

        db.get(sql, [countryCode], (err, rows) => {
            callback(err, rows);
        });
    } catch (error) {
        throw error;
    }
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
    setCountryData,
    getCountryData,
    cleanExpired
}