const tableName = 'tableViatorDestinations';

const init = function (db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      destinationId INTEGER PRIMARY KEY,
      uuid TEXT NOT NULL DEFAULT (lower(hex(randomblob(16)))),
      name TEXT,
      type TEXT,
      parentDestinationId INTEGER,
      lookupId TEXT,
      destinationUrl TEXT,
      defaultCurrencyCode TEXT,
      timeZone TEXT,
      iataCodes TEXT,
      countryCallingCode TEXT,
      languages TEXT,
      centerLat REAL,
      centerLng REAL,
      syncRunId TEXT,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;
  db.exec(sql);
};

const countAll = function (db) {
  const sql = `SELECT COUNT(1) AS total FROM ${tableName};`;
  const row = db.prepare(sql).get();
  return row?.total ?? 0;
};

const prepareUpsert = function (db) {
  const sql = `
    INSERT INTO ${tableName} (
      destinationId,
      name,
      type,
      parentDestinationId,
      lookupId,
      destinationUrl,
      defaultCurrencyCode,
      timeZone,
      iataCodes,
      countryCallingCode,
      languages,
      centerLat,
      centerLng,
      syncRunId,
      updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(destinationId) DO UPDATE SET
      name = excluded.name,
      type = excluded.type,
      parentDestinationId = excluded.parentDestinationId,
      lookupId = excluded.lookupId,
      destinationUrl = excluded.destinationUrl,
      defaultCurrencyCode = excluded.defaultCurrencyCode,
      timeZone = excluded.timeZone,
      iataCodes = excluded.iataCodes,
      countryCallingCode = excluded.countryCallingCode,
      languages = excluded.languages,
      centerLat = excluded.centerLat,
      centerLng = excluded.centerLng,
      syncRunId = excluded.syncRunId,
      updatedAt = datetime('now');
  `;
  return db.prepare(sql);
};

const deleteNotRunId = function (db, syncRunId) {
  const sql = `
    DELETE FROM ${tableName}
    WHERE syncRunId IS NOT NULL
      AND syncRunId != ?;
  `;
  const result = db.prepare(sql).run(syncRunId);
  return result?.changes ?? 0;
};

const getByIds = function (db, destinationIds) {
  if (!Array.isArray(destinationIds) || destinationIds.length === 0) {
    return [];
  }
  const placeholders = destinationIds.map(() => '?').join(', ');
  const sql = `
    SELECT *
    FROM ${tableName}
    WHERE destinationId IN (${placeholders});
  `;
  return db.prepare(sql).all(destinationIds);
};

module.exports = {
  init,
  countAll,
  prepareUpsert,
  deleteNotRunId,
  getByIds
};
