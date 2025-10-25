const tableName = 'tableStatistic';

const columnKey = 'metricKey';
const columnDate = 'metricDate';
const columnValue = 'value';

const init = function (db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      ${columnKey}  TEXT NOT NULL,
      ${columnDate} TEXT NOT NULL,
      ${columnValue} INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (${columnKey}, ${columnDate})
    );
    CREATE INDEX IF NOT EXISTS idx_stat_key_date
      ON ${tableName}(${columnKey}, ${columnDate});
  `;
  db.exec(sql, (err) => { if (err) throw err; });
};

/**
 * +amount (Default 1) für (key, dateStr)
 * dateStr muss 'YYYY-MM-DD' sein (UTC oder lokal – du entscheidest in der Middleware)
 */
const count = function (db, key, { dateStr, amount = 1 } = {}, callback = () => { }) {
  const sql = `
    INSERT INTO ${tableName} (${columnKey}, ${columnDate}, ${columnValue})
    VALUES (?, ?, ?)
    ON CONFLICT(${columnKey}, ${columnDate})
      DO UPDATE SET ${columnValue} = ${columnValue} + excluded.${columnValue};
  `;
  db.run(sql, [key, dateStr, Number(amount) || 1], (err) => callback(err || null));
};

/** Ältere Einträge als N Tage löschen (Default 365) – vergleicht lexikografisch auf 'YYYY-MM-DD' */
const clean = function (db, maxDays = 365, callback = () => { }) {
  const threshold = (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - Number(maxDays));
    return d.toISOString().slice(0, 10); // UTC YYYY-MM-DD
  })();
  const sql = `DELETE FROM ${tableName} WHERE ${columnDate} < ?;`;
  db.run(sql, [threshold], (err) => callback(err || null));
};

/** Bereich für einen key ab (today - days) */
const getRange = function (db, key, days = 365, callback = () => { }) {
  const start = (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - Number(days));
    return d.toISOString().slice(0, 10); // UTC YYYY-MM-DD
  })();
  const sql = `
    SELECT ${columnDate} AS date, ${columnValue} AS value
    FROM ${tableName}
    WHERE ${columnKey} = ? AND ${columnDate} >= ?
    ORDER BY ${columnDate} ASC;
  `;
  db.all(sql, [key, start], (err, rows) => callback(err || null, rows));
};

function getKeys(db, callback = () => { }) {
  const sql = `
    SELECT DISTINCT ${columnKey} AS key
    FROM ${tableName}
    ORDER BY ${columnKey} ASC;
  `;
  db.all(sql, [], (err, rows) => callback(err || null, rows?.map(r => r.key) || []));
}

/** Bereich mit explizitem From/To (inklusive) */
function getRangeBetween(db, key, fromDate, toDate, callback = () => { }) {
  const sql = `
    SELECT ${columnDate} AS date, ${columnValue} AS value
    FROM ${tableName}
    WHERE ${columnKey} = ?
      AND ${columnDate} >= ?
      AND ${columnDate} <= ?
    ORDER BY ${columnDate} ASC;
  `;
  db.all(sql, [key, fromDate, toDate], (err, rows) => callback(err || null, rows));
}

module.exports = {
  // Konstanten exportieren, damit du sie (falls gewünscht) woanders referenzieren kannst
  tableName,
  columnKey,
  columnDate,
  columnValue,
  init,
  count,
  clean,
  getRange,
  getRangeBetween,
  getKeys
};