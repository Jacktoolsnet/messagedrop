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
            ${columnLastUpdate} DATETIME DEFAULT CURRENT_TIMESTAMP
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
        INSERT OR REPLACE INTO ${tableName} (${columnCountryCode}, ${columnCountryData}, ${columnWorldbankData}, ${columnLastUpdate})
        VALUES (?, ?, ?, datetime('now'));`;

        db.run(sql, [
            countryCode,
            countryData,
            worldBankData,
            now
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

module.exports = {
    init,
    setCountryData,
    getCountryData
}