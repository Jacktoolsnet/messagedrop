const tableName = 'tableAiUsageEvent';

function init(db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      createdAt INTEGER NOT NULL,
      tool TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      inputTokens INTEGER NOT NULL DEFAULT 0,
      outputTokens INTEGER NOT NULL DEFAULT 0,
      totalTokens INTEGER NOT NULL DEFAULT 0,
      cachedInputTokens INTEGER NOT NULL DEFAULT 0,
      reasoningTokens INTEGER NOT NULL DEFAULT 0
    );
  `;

  db.exec(sql, (err) => {
    if (err) {
      throw err;
    }
  });
}

function insert(db, payload, callback = () => {}) {
  const sql = `
    INSERT INTO ${tableName} (
      createdAt,
      tool,
      model,
      inputTokens,
      outputTokens,
      totalTokens,
      cachedInputTokens,
      reasoningTokens
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(sql, [
    Number.isFinite(Number(payload?.createdAt)) ? Number(payload.createdAt) : Date.now(),
    typeof payload?.tool === 'string' ? payload.tool.trim().slice(0, 60) : '',
    typeof payload?.model === 'string' ? payload.model.trim().slice(0, 120) : '',
    toSafeInteger(payload?.inputTokens),
    toSafeInteger(payload?.outputTokens),
    toSafeInteger(payload?.totalTokens),
    toSafeInteger(payload?.cachedInputTokens),
    toSafeInteger(payload?.reasoningTokens)
  ], function (err) {
    if (err) {
      callback(err);
      return;
    }
    callback(null, {
      id: this?.lastID ?? null,
      changed: Number(this?.changes ?? 0) > 0
    });
  });
}

function sumRange(db, range, callback = () => {}) {
  const sql = `
    SELECT
      COUNT(*) AS requestCount,
      COALESCE(SUM(inputTokens), 0) AS inputTokens,
      COALESCE(SUM(outputTokens), 0) AS outputTokens,
      COALESCE(SUM(totalTokens), 0) AS totalTokens,
      COALESCE(SUM(cachedInputTokens), 0) AS cachedInputTokens,
      COALESCE(SUM(reasoningTokens), 0) AS reasoningTokens
    FROM ${tableName}
    WHERE createdAt >= ? AND createdAt < ?
  `;

  db.get(sql, [
    Number.isFinite(Number(range?.startTime)) ? Number(range.startTime) : 0,
    Number.isFinite(Number(range?.endTime)) ? Number(range.endTime) : Date.now()
  ], (err, row) => {
    if (err) {
      callback(err);
      return;
    }
    callback(null, {
      requestCount: toSafeInteger(row?.requestCount),
      inputTokens: toSafeInteger(row?.inputTokens),
      outputTokens: toSafeInteger(row?.outputTokens),
      totalTokens: toSafeInteger(row?.totalTokens),
      cachedInputTokens: toSafeInteger(row?.cachedInputTokens),
      reasoningTokens: toSafeInteger(row?.reasoningTokens)
    });
  });
}

function toSafeInteger(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.floor(parsed);
}

module.exports = {
  tableName,
  init,
  insert,
  sumRange
};
