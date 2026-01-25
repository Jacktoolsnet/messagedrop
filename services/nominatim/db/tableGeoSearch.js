const tableName = 'tableGeoSearch';
const columnNormalizedQuery = 'normalizedQuery';
const columnGeoData = 'geoData';
const columnLastUpdate = 'lastUpdate';


const init = function (db) {
    const sql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
            ${columnNormalizedQuery} TEXT PRIMARY KEY,
            ${columnGeoData} TEXT,
            ${columnLastUpdate} DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `;
    db.exec(sql);
};

function normalizeQuery(query) {
    return query
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .sort()
        .join(' ');
}

const setGeoSearchResult = function (db, rawQuery, geoData, callback) {
    const normalized = normalizeQuery(rawQuery);
    const sql = `
        INSERT OR REPLACE INTO ${tableName} 
        (${columnNormalizedQuery}, ${columnGeoData}, ${columnLastUpdate})
        VALUES (?, ?, datetime('now'));
    `;
    try {
        db.prepare(sql).run(normalized, JSON.stringify(geoData));
        if (callback) callback(null);
    } catch (err) {
        if (callback) return callback(err);
        throw err;
    }
};


const getGeoSearchResult = function (db, rawQuery, callback) {
    const normalized = normalizeQuery(rawQuery);
    const sql = `SELECT * FROM ${tableName} WHERE ${columnNormalizedQuery} = ?`;
    try {
        const row = db.prepare(sql).get(normalized);
        if (!row) return callback(null, null);
        try {
            const parsedData = JSON.parse(row.geoData);
            callback(null, parsedData);
        } catch (parseErr) {
            callback(parseErr);
        }
    } catch (err) {
        return callback(err);
    }
};

const cleanExpired = function (db, callback) {
    const sql = `
        DELETE FROM ${tableName}
        WHERE DATETIME(${columnLastUpdate}) < DATETIME('now', '-1 month');
    `;
    try {
        db.prepare(sql).run();
        if (callback) callback(null);
    } catch (err) {
        if (callback) return callback(err);
        throw err;
    }
};

module.exports = {
    init,
    setGeoSearchResult,
    getGeoSearchResult,
    cleanExpired
};
