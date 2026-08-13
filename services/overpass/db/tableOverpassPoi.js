const DATASET_TABLE = 'tableOverpassDataset';
const POI_TABLE = 'tableOverpassPoi';

function init(db, callback) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${DATASET_TABLE} (
      datasetId TEXT PRIMARY KEY,
      sourceUrl TEXT NOT NULL,
      sourceTimestamp TIMESTAMPTZ,
      south DOUBLE PRECISION NOT NULL,
      west DOUBLE PRECISION NOT NULL,
      north DOUBLE PRECISION NOT NULL,
      east DOUBLE PRECISION NOT NULL,
      importedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      poiCount INTEGER NOT NULL DEFAULT 0,
      CHECK (south < north),
      CHECK (west < east)
    );
    CREATE TABLE IF NOT EXISTS ${POI_TABLE} (
      datasetId TEXT NOT NULL REFERENCES ${DATASET_TABLE}(datasetId) ON DELETE CASCADE,
      osmType TEXT NOT NULL CHECK (osmType IN ('node', 'way', 'relation')),
      osmId BIGINT NOT NULL,
      category TEXT NOT NULL,
      subtype TEXT NOT NULL,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      payload JSONB NOT NULL,
      PRIMARY KEY (datasetId, osmType, osmId)
    );
    CREATE INDEX IF NOT EXISTS idx_overpass_poi_bounds
      ON ${POI_TABLE} (latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_overpass_poi_category_subtype
      ON ${POI_TABLE} (category, subtype);
  `, callback);
}

function coveringDataset(db, bounds, callback) {
  db.get(`
    SELECT datasetId, sourceUrl, sourceTimestamp, south, west, north, east, importedAt, poiCount
    FROM ${DATASET_TABLE}
    WHERE south <= ? AND west <= ? AND north >= ? AND east >= ?
    ORDER BY ((north - south) * (east - west)) ASC, importedAt DESC
    LIMIT 1
  `, [bounds.south, bounds.west, bounds.north, bounds.east], callback);
}

function status(db, callback) {
  db.get(`
    SELECT COUNT(*)::integer AS datasetCount, COALESCE(SUM(poiCount), 0)::integer AS poiCount,
      MAX(importedAt) AS importedAt
    FROM ${DATASET_TABLE}
  `, [], callback);
}

function nearby(db, datasetId, bounds, selections, limit, callback) {
  const clauses = [];
  const params = [datasetId, bounds.south, bounds.north, bounds.west, bounds.east];
  for (const [category, subtypes] of Object.entries(selections)) {
    clauses.push('(category = ? AND subtype = ANY(?::text[]))');
    params.push(category, subtypes);
  }
  params.push(limit);
  db.all(`
    SELECT payload
    FROM ${POI_TABLE}
    WHERE datasetId = ?
      AND latitude BETWEEN ? AND ?
      AND longitude BETWEEN ? AND ?
      AND (${clauses.join(' OR ')})
    ORDER BY category, subtype, osmType, osmId
    LIMIT ?
  `, params, callback);
}

async function replaceDataset(db, dataset, pois) {
  await db.transaction(async (transaction) => {
    await run(transaction, `DELETE FROM ${DATASET_TABLE} WHERE datasetId = ?`, [dataset.id]);
    await run(transaction, `
      INSERT INTO ${DATASET_TABLE}
        (datasetId, sourceUrl, sourceTimestamp, south, west, north, east, importedAt, poiCount)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
    `, [
      dataset.id,
      dataset.sourceUrl,
      dataset.sourceTimestamp || null,
      dataset.bounds.south,
      dataset.bounds.west,
      dataset.bounds.north,
      dataset.bounds.east,
      pois.length
    ]);
    for (const poi of pois) {
      await run(transaction, `
        INSERT INTO ${POI_TABLE}
          (datasetId, osmType, osmId, category, subtype, latitude, longitude, payload)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb)
      `, [
        dataset.id, poi.osmType, poi.osmId, poi.category, poi.subtype,
        poi.latitude, poi.longitude, JSON.stringify(poi)
      ]);
    }
  });
}

function run(db, sql, params) {
  return new Promise((resolve, reject) => db.run(sql, params, (error) => {
    if (error) reject(error);
    else resolve();
  }));
}

module.exports = { init, status, coveringDataset, nearby, replaceDataset };
