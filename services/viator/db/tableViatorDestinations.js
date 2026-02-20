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
      plusCode TEXT,
      syncRunId TEXT,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;
  db.exec(sql);
};

const upsertSql = `
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
    plusCode,
    syncRunId,
    updatedAt
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
    plusCode = excluded.plusCode,
    syncRunId = excluded.syncRunId,
    updatedAt = datetime('now');
`;

const countAll = function (db, callback = () => { }) {
  const sql = `SELECT COUNT(1) AS total FROM ${tableName};`;
  db.get(sql, [], (err, row) => {
    if (err) {
      callback(err);
      return;
    }
    callback(null, row?.total ?? 0);
  });
};

const upsert = function (db, destination, syncRunId, callback = () => { }) {
  const params = [
    destination.destinationId,
    destination.name ?? null,
    destination.type ?? null,
    destination.parentDestinationId ?? null,
    destination.lookupId ?? null,
    destination.destinationUrl ?? null,
    destination.defaultCurrencyCode ?? null,
    destination.timeZone ?? null,
    destination.iataCodes ?? null,
    destination.countryCallingCode ?? null,
    destination.languages ?? null,
    destination.centerLat ?? null,
    destination.centerLng ?? null,
    destination.plusCode ?? null,
    syncRunId ?? null
  ];
  db.run(upsertSql, params, function (err) {
    if (err) {
      callback(err);
      return;
    }
    callback(null, Number(this?.changes ?? 0));
  });
};

const deleteNotRunId = function (db, syncRunId, callback = () => { }) {
  const sql = `
    DELETE FROM ${tableName}
    WHERE syncRunId IS NOT NULL
      AND syncRunId != ?;
  `;
  db.run(sql, [syncRunId], function (err) {
    if (err) {
      callback(err);
      return;
    }
    callback(null, Number(this?.changes ?? 0));
  });
};

const getByIds = function (db, destinationIds, callback = () => { }) {
  if (!Array.isArray(destinationIds) || destinationIds.length === 0) {
    callback(null, []);
    return;
  }
  const placeholders = destinationIds.map(() => '?').join(', ');
  const sql = `
    SELECT *
    FROM ${tableName}
    WHERE destinationId IN (${placeholders});
  `;
  db.all(sql, destinationIds, (err, rows) => {
    if (err) {
      callback(err);
      return;
    }
    callback(null, rows || []);
  });
};

const getAll = function (db, types, callback = () => { }) {
  if (Array.isArray(types) && types.length > 0) {
    const placeholders = types.map(() => '?').join(', ');
    const sql = `
      SELECT *
      FROM ${tableName}
      WHERE type IN (${placeholders});
    `;
    db.all(sql, types, (err, rows) => {
      if (err) {
        callback(err);
        return;
      }
      callback(null, rows || []);
    });
    return;
  }
  const sql = `
    SELECT *
    FROM ${tableName};
  `;
  db.all(sql, [], (err, rows) => {
    if (err) {
      callback(err);
      return;
    }
    callback(null, rows || []);
  });
};

module.exports = {
  init,
  countAll,
  upsert,
  deleteNotRunId,
  getByIds,
  getAll
};
