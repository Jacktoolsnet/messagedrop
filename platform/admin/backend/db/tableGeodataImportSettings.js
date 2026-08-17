const tableName = 'tableGeodataImportSettings';

const DEFAULTS = Object.freeze({
  id: 1, enabled: false, datasets: ['germany'],
  categories: ['accommodation', 'tourism', 'leisure', 'food_drink', 'amenities', 'religion'],
  subcategories: {},
  scheduleType: 'weekly', weekday: 0, hour: 3, minute: 0,
  timezone: 'Europe/Berlin', refreshSource: true, lastTriggeredAt: 0, updatedAt: 0
});

function init(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enabled INTEGER NOT NULL DEFAULT 0,
      datasets TEXT NOT NULL DEFAULT '["wolfenbuettel"]',
      categories TEXT NOT NULL DEFAULT '[]',
      subcategories TEXT NOT NULL DEFAULT '{}',
      scheduleType TEXT NOT NULL DEFAULT 'weekly',
      weekday INTEGER NOT NULL DEFAULT 0,
      hour INTEGER NOT NULL DEFAULT 3,
      minute INTEGER NOT NULL DEFAULT 0,
      timezone TEXT NOT NULL DEFAULT 'Europe/Berlin',
      refreshSource INTEGER NOT NULL DEFAULT 1,
      lastTriggeredAt INTEGER NOT NULL DEFAULT 0,
      updatedAt INTEGER NOT NULL DEFAULT 0
    );
  `, (err) => { if (err) throw err; });
  db.run(`
    INSERT INTO ${tableName}
      (id, enabled, datasets, categories, scheduleType, weekday, hour, minute, timezone, refreshSource)
    VALUES (1, 0, ?, ?, 'weekly', 0, 3, 0, 'Europe/Berlin', 1)
    ON CONFLICT(id) DO NOTHING
  `, [JSON.stringify(DEFAULTS.datasets), JSON.stringify(DEFAULTS.categories)]);
  db.run(`ALTER TABLE ${tableName} ADD COLUMN subcategories TEXT NOT NULL DEFAULT '{}'`, [], (err) => {
    if (err && !String(err.message || '').includes('duplicate column name')) throw err;
  });
  db.run(`UPDATE ${tableName} SET datasets = '["germany"]' WHERE datasets = '["wolfenbuettel"]'`);
}

function decode(row) {
  if (!row) return { ...DEFAULTS };
  const json = (value, fallback) => { try { return JSON.parse(value); } catch { return fallback; } };
  return {
    id: Number(row.id ?? DEFAULTS.id),
    enabled: Boolean(row.enabled),
    scheduleType: row.scheduleType ?? row.scheduletype ?? DEFAULTS.scheduleType,
    weekday: Number(row.weekday ?? DEFAULTS.weekday),
    hour: Number(row.hour ?? DEFAULTS.hour),
    minute: Number(row.minute ?? DEFAULTS.minute),
    timezone: row.timezone ?? DEFAULTS.timezone,
    refreshSource: Boolean(row.refreshSource ?? row.refreshsource),
    lastTriggeredAt: Number(row.lastTriggeredAt ?? row.lasttriggeredat ?? DEFAULTS.lastTriggeredAt),
    updatedAt: Number(row.updatedAt ?? row.updatedat ?? DEFAULTS.updatedAt),
    datasets: json(row.datasets, DEFAULTS.datasets),
    categories: json(row.categories, DEFAULTS.categories),
    subcategories: json(row.subcategories, DEFAULTS.subcategories)
  };
}

function get(db, callback = () => {}) {
  db.get(`SELECT * FROM ${tableName} WHERE id = 1`, [], (err, row) => callback(err, err ? undefined : decode(row)));
}

function upsert(db, value, callback = () => {}) {
  const updatedAt = Date.now();
  db.run(`
    UPDATE ${tableName} SET enabled = ?, datasets = ?, categories = ?, subcategories = ?, scheduleType = ?,
      weekday = ?, hour = ?, minute = ?, timezone = ?, refreshSource = ?, updatedAt = ?
    WHERE id = 1
  `, [value.enabled ? 1 : 0, JSON.stringify(value.datasets), JSON.stringify(value.categories), JSON.stringify(value.subcategories || {}),
    value.scheduleType, value.weekday, value.hour, value.minute, value.timezone,
    value.refreshSource ? 1 : 0, updatedAt], (err) => {
    if (err) return callback(err);
    get(db, callback);
  });
}

function markTriggered(db, timestamp, callback = () => {}) {
  db.run(`UPDATE ${tableName} SET lastTriggeredAt = ? WHERE id = 1`, [timestamp], callback);
}

module.exports = { tableName, DEFAULTS, decode, init, get, upsert, markTriggered };
