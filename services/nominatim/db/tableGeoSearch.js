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
    db.run(sql, [normalized, JSON.stringify(geoData)], (err) => {
        if (callback) callback(err || null);
    });
};


const getGeoSearchResult = function (db, rawQuery, callback) {
    const normalized = normalizeQuery(rawQuery);
    const sql = `SELECT * FROM ${tableName} WHERE ${columnNormalizedQuery} = ?`;
    db.get(sql, [normalized], (err, row) => {
        if (err) {
            if (callback) callback(err);
            return;
        }
        if (!row) {
            if (callback) callback(null, null);
            return;
        }
        try {
            const parsedData = JSON.parse(row.geoData);
            if (callback) callback(null, parsedData);
        } catch (parseErr) {
            if (callback) callback(parseErr);
        }
    });
};

const cleanExpired = function (db, callback) {
    const sql = `
        DELETE FROM ${tableName}
        WHERE DATETIME(${columnLastUpdate}) < DATETIME('now', '-1 month');
    `;
    db.run(sql, [], (err) => {
        if (callback) callback(err || null);
    });
};

module.exports = {
    init,
    setGeoSearchResult,
    getGeoSearchResult,
    cleanExpired
};
