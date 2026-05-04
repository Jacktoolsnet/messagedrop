const fs = require('fs');
const path = require('path');
const tableUser = require('./tableUser');
const tableConnect = require('./tableConnect');
const tableContact = require('./tableContact');
const tableContactMessage = require('./tableContactMessage');
const tableContactProfileExchange = require('./tableContactProfileExchange');
const tableMessage = require('./tableMessage');
const tableMessageTranslation = require('./tableMessageTranslation');
const tableLike = require('./tableLike');
const tableDislike = require('./tableDislike');
const tablePlace = require('./tablePlace');
const tableWeatherHistory = require('./tableWeatherHistory');
const tableNotification = require('./tableNotification');
const tableGeoStatistic = require('./tableGeoStatistic');
const tableMaintenance = require('./tableMaintenance');
const tableUsageProtection = require('./tableUsageProtection');
const tableUserModerationAppeal = require('./tableUserModerationAppeal');


const DEFAULT_MAX_PENDING_REQUESTS = 1000;

function resolveMaxPendingRequests(rawValue) {
  const parsed = Number.parseInt(String(rawValue ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_PENDING_REQUESTS;
  }
  return parsed;
}

function createQueueOverloadedError(pendingCount, maxPendingRequests) {
  const error = new Error('Database queue overloaded');
  error.code = 'DB_QUEUE_OVERLOADED';
  error.status = 503;
  error.statusCode = 503;
  error.errorCode = 'SERVICE_UNAVAILABLE';
  error.detail = { pendingCount, maxPendingRequests };
  return error;
}

function buildIdentifierMap() {
  const map = new Map();
  const add = (identifier) => {
    if (typeof identifier !== 'string' || !/[A-Z]/.test(identifier)) return;
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(identifier)) return;
    map.set(identifier.toLowerCase(), identifier);
  };

  try {
    for (const entry of fs.readdirSync(__dirname)) {
      if (!/^table.*\.js$/.test(entry)) continue;
      const content = fs.readFileSync(path.join(__dirname, entry), 'utf8');
      for (const match of content.matchAll(/['`]([A-Za-z][A-Za-z0-9_]*[A-Z][A-Za-z0-9_]*)['`]/g)) {
        add(match[1]);
      }
      for (const match of content.matchAll(/\bAS\s+([A-Za-z][A-Za-z0-9_]*[A-Z][A-Za-z0-9_]*)/g)) {
        add(match[1]);
      }
    }
  } catch {
    // Best-effort only.
  }

  return map;
}

const IDENTIFIER_MAP = buildIdentifierMap();

function normalizeRow(row) {
  if (!row || typeof row !== 'object') return row;
  const normalized = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[IDENTIFIER_MAP.get(String(key).toLowerCase()) || key] = value;
  }
  return normalized;
}

function splitSqlStatements(sql) {
  const source = String(sql || '');
  const statements = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let dollarTag = null;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];
    if (!inSingle && !inDouble && !dollarTag && ch === '-' && next === '-') {
      while (i < source.length && source[i] !== '\n') i += 1;
      continue;
    }
    if (!inDouble && !dollarTag && ch === "'" && source[i - 1] !== '\\') inSingle = !inSingle;
    if (!inSingle && !dollarTag && ch === '"' && source[i - 1] !== '\\') inDouble = !inDouble;
    if (!inSingle && !inDouble && ch === '$') {
      const rest = source.slice(i);
      const match = rest.match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (match) {
        if (dollarTag === match[0]) dollarTag = null;
        else if (!dollarTag) dollarTag = match[0];
        current += match[0];
        i += match[0].length - 1;
        continue;
      }
    }
    if (ch === ';' && !inSingle && !inDouble && !dollarTag) {
      if (current.trim()) statements.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

function replaceSqlitePlaceholders(sql) {
  let index = 0;
  return String(sql || '').replace(/\?/g, () => `$${++index}`);
}

function preparePostgresSql(sql) {
  let prepared = String(sql || '').trim();
  if (!prepared) return prepared;
  if (/^PRAGMA\b/i.test(prepared)) return '';
  if (/^CREATE\s+TRIGGER\b/i.test(prepared)) return '';

  prepared = prepared.replace(/\s+COLLATE\s+NOCASE\b/gi, '');
  prepared = prepared.replace(/\bINTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT\b/gi, 'BIGSERIAL PRIMARY KEY');
  prepared = prepared.replace(/\bDATETIME\b/gi, 'TIMESTAMPTZ');
  prepared = prepared.replace(/\bNUMBER\b/gi, 'REAL');
  prepared = prepared.replace(/\bINTEGER\b/g, 'BIGINT');
  prepared = prepared.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');
  prepared = prepared.replace(/INSERT\s+OR\s+REPLACE\s+INTO/gi, 'INSERT INTO');
  prepared = prepared.replace(/strftime\('\%s','now','\+30 days'\)/gi, "EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP + INTERVAL '30 days'))::BIGINT");
  prepared = prepared.replace(/strftime\('\%s','now'\)/gi, 'EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::BIGINT');
  prepared = prepared.replace(/CONSTRAINT\s+SECONDARY_KEY\s+UNIQUE/gi, 'UNIQUE');
  prepared = prepared.replace(/strftime\('\%Y-\%m-\%dT\%H:\%M:\%S','now'\)/gi, `to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS')`);
  prepared = prepared.replace(/datetime\('now','-90 days'\)/gi, "CURRENT_TIMESTAMP - INTERVAL '90 days'");
  prepared = prepared.replace(/datetime\('now', '-1 month'\)/gi, "CURRENT_TIMESTAMP - INTERVAL '1 month'");
  prepared = prepared.replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP');
  prepared = prepared.replace(/DATE\('now', '-1 month'\)/gi, "CURRENT_DATE - INTERVAL '1 month'");
  prepared = prepared.replace(/DATETIME\(([^)]+)\)/gi, '$1');
  prepared = prepared.replace(/\bMAX\(([^,()]+)\s*,\s*0\)/gi, 'GREATEST($1, 0)');
  prepared = prepared.replace(/DATE\(([^)]+)\)/gi, '$1::date');

  if (/^INSERT\s+INTO\b/i.test(prepared) && /\bOR\s+IGNORE\b/i.test(String(sql || '')) && !/\bON\s+CONFLICT\b/i.test(prepared)) {
    prepared = `${prepared.replace(/;\s*$/, '')} ON CONFLICT DO NOTHING`;
  }

  return replaceSqlitePlaceholders(prepared);
}

function createDbConfigFromEnv() {
  const connectionString = process.env.BACKEND_DATABASE_URL || process.env.DATABASE_URL;
  const sslEnabled = String(process.env.BACKEND_DB_SSL || process.env.DB_SSL || '').toLowerCase() === 'true';
  const max = Number(process.env.BACKEND_DB_POOL_MAX || process.env.DB_POOL_MAX || 10);
  if (connectionString) {
    return {
      connectionString,
      max: Number.isFinite(max) && max > 0 ? max : 10,
      ssl: sslEnabled ? { rejectUnauthorized: false } : undefined
    };
  }
  return {
    host: process.env.BACKEND_DB_HOST || process.env.DB_HOST || 'localhost',
    port: Number(process.env.BACKEND_DB_PORT || process.env.DB_PORT || 5432),
    database: process.env.BACKEND_DB_NAME || process.env.DB_NAME || 'messagedrop_backend',
    user: process.env.BACKEND_DB_USER || process.env.DB_USER || 'messagedrop',
    password: process.env.BACKEND_DB_PASSWORD || process.env.DB_PASSWORD || undefined,
    max: Number.isFinite(max) && max > 0 ? max : 10,
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined
  };
}

class PostgresCompat {
  constructor(config, logger = console) {
    const { Pool, types } = require('pg');
    types.setTypeParser(20, (value) => Number(value));
    this._pool = new Pool(config);
    this._logger = logger ?? console;
    this._closed = false;
    this._chain = Promise.resolve();
    this._pendingCount = 0;
    this._maxPendingRequests = resolveMaxPendingRequests(process.env.DB_MAX_PENDING_REQUESTS);
  }

  _normalizeError(error) {
    if (error?.code === '42701' && !String(error.message || '').includes('duplicate column name')) {
      error.message = `duplicate column name: ${error.message}`;
    }
    return error;
  }

  _safeInvokeCallback(callback, error, value, context = null) {
    error = error ? this._normalizeError(error) : error;
    if (typeof callback !== 'function') {
      if (error) this._logger?.error?.(error?.message || error);
      return;
    }
    try {
      if (context) {
        callback.call(context, error || null, value);
        return;
      }
      callback(error || null, value);
    } catch (callbackError) {
      this._logger?.error?.('PostgreSQL callback failed', callbackError);
    }
  }

  _normalizeParams(params, callback) {
    if (typeof params === 'function') return { params: [], callback: params };
    return { params: Array.isArray(params) ? params : (params === undefined ? [] : [params]), callback };
  }

  _normalizeStatementArgs(args) {
    const values = Array.from(args ?? []);
    let callback;
    if (values.length && typeof values[values.length - 1] === 'function') callback = values.pop();
    if (values.length === 0) return { params: [], callback };
    if (values.length === 1 && Array.isArray(values[0])) return { params: values[0], callback };
    return { params: values, callback };
  }

  _enqueue(task) {
    if (this.isOverloaded()) {
      return Promise.reject(createQueueOverloadedError(this._pendingCount, this._maxPendingRequests));
    }
    this._pendingCount += 1;
    const run = this._chain.then(task, task).finally(() => {
      this._pendingCount = Math.max(0, this._pendingCount - 1);
    });
    this._chain = run.catch(() => {});
    return run;
  }

  async _tableInfo(sql) {
    const match = String(sql || '').match(/^PRAGMA\s+table_info\(([^)]+)\)/i);
    if (!match) return null;
    const rawName = match[1].trim().replace(/^[`'\"]|[`'\"]$/g, '');
    const result = await this._pool.query(`
      SELECT column_name AS name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = $1
      ORDER BY ordinal_position
    `, [rawName.toLowerCase()]);
    return result.rows.map((row) => ({ name: IDENTIFIER_MAP.get(String(row.name).toLowerCase()) || row.name }));
  }

  async _foreignKeyList() {
    return [];
  }

  async _queryNow(sql, params = []) {
    if (this._closed) throw new Error('Database connection is closed');
    const tableInfo = await this._tableInfo(sql);
    if (tableInfo) return { rows: tableInfo, rowCount: tableInfo.length };
    if (/^PRAGMA\s+foreign_key_list\b/i.test(String(sql || '').trim())) return { rows: await this._foreignKeyList(), rowCount: 0 };
    const prepared = preparePostgresSql(sql);
    if (!prepared) return { rows: [], rowCount: 0 };
    return this._pool.query(prepared, params);
  }

  _query(sql, params = []) {
    return this._enqueue(() => this._queryNow(sql, params));
  }

  exec(sql, callback) {
    this._enqueue(async () => {
      for (const statement of splitSqlStatements(sql)) {
        await this._queryNow(statement, []);
      }
    })
      .then(() => this._safeInvokeCallback(callback, null))
      .catch((err) => this._safeInvokeCallback(callback, err));
  }

  run(sql, params, callback) {
    const normalized = this._normalizeParams(params, callback);
    this._query(sql, normalized.params)
      .then((result) => this._safeInvokeCallback(normalized.callback, null, undefined, {
        changes: Number(result?.rowCount ?? 0),
        lastID: result?.rows?.[0]?.id ?? null
      }))
      .catch((err) => this._safeInvokeCallback(normalized.callback, err));
  }

  get(sql, params, callback) {
    const normalized = this._normalizeParams(params, callback);
    this._query(sql, normalized.params)
      .then((result) => this._safeInvokeCallback(normalized.callback, null, normalizeRow(result?.rows?.[0]) || null))
      .catch((err) => this._safeInvokeCallback(normalized.callback, err));
  }

  all(sql, params, callback) {
    const normalized = this._normalizeParams(params, callback);
    this._query(sql, normalized.params)
      .then((result) => this._safeInvokeCallback(normalized.callback, null, (result?.rows || []).map(normalizeRow)))
      .catch((err) => this._safeInvokeCallback(normalized.callback, err));
  }

  prepare(sql) {
    return {
      run: (...args) => {
        const { params, callback } = this._normalizeStatementArgs(args);
        this.run(sql, params, callback);
      },
      get: (...args) => {
        const { params, callback } = this._normalizeStatementArgs(args);
        this.get(sql, params, callback);
      },
      all: (...args) => {
        const { params, callback } = this._normalizeStatementArgs(args);
        this.all(sql, params, callback);
      },
      finalize: (callback) => this._safeInvokeCallback(callback, null)
    };
  }

  pendingCount() { return this._pendingCount; }
  maxPendingRequests() { return this._maxPendingRequests; }
  isOverloaded() { return this._pendingCount >= this._maxPendingRequests; }
  serialize(fn) { if (typeof fn === 'function') fn(); }

  close(callback) {
    if (this._closed) {
      this._safeInvokeCallback(callback, null);
      return;
    }
    this._closed = true;
    this._chain
      .then(() => this._pool.end())
      .then(() => this._safeInvokeCallback(callback, null))
      .catch((err) => this._safeInvokeCallback(callback, err));
  }
}

class Database {
  constructor() {
    this.db = null;
    this.logger = console;
  }

  init(logger) {
    this.logger = logger ?? this.logger;
    return new Promise((resolve, reject) => {
      try {
        this.db = new PostgresCompat(createDbConfigFromEnv(), this.logger);
        this.db.serialize(() => {
          tableUser.init(this.db);
          tableConnect.init(this.db);
          tableContact.init(this.db);
          tableContactMessage.init(this.db);
          tableContactProfileExchange.init(this.db);
          tableMessage.init(this.db);
          tableMessageTranslation.init(this.db);
          tableLike.init(this.db);
          tableDislike.init(this.db);
          tablePlace.init(this.db);
          tableGeoStatistic.init(this.db);
          tableWeatherHistory.init(this.db);
          tableNotification.init(this.db);
          tableMaintenance.init(this.db);
          tableUsageProtection.init(this.db);
          tableUserModerationAppeal.init(this.db);
          this.initTriggers(this.logger);
          this.initIndexes(this.logger);
          this.db.get('SELECT 1;', (readyErr) => {
            if (readyErr) {
              reject(readyErr);
              return;
            }
            this.logger.info('Connected to the messagedrop PostgreSQL database.');
            resolve();
          });
        });
      } catch (err) {
        this.logger.error('Failed to open PostgreSQL database.', err);
        reject(err);
      }
    });
  }

  close() {
    try {
      this.db?.close((err) => {
        if (err) return;
        this.logger?.info('Close the database connection.');
      });
    } catch (err) {
      this.logger?.error?.(err?.message || err);
    }
  }

  pendingCount() {
    return typeof this.db?.pendingCount === 'function' ? this.db.pendingCount() : 0;
  }

  maxPendingRequests() {
    return typeof this.db?.maxPendingRequests === 'function'
      ? this.db.maxPendingRequests()
      : DEFAULT_MAX_PENDING_REQUESTS;
  }

  isOverloaded() {
    return typeof this.db?.isOverloaded === 'function' ? this.db.isOverloaded() : false;
  }

  initTriggers(logger = this.logger) {
    const triggers = `
    /* =======================
       LIKE / DISLIKE 
       ======================= */
       
    -- Likes inkrementieren
    CREATE TRIGGER IF NOT EXISTS trg_like_after_insert
    AFTER INSERT ON tableLike
    BEGIN
      UPDATE tableMessage
      SET likes = likes + 1
      WHERE uuid = NEW.likeMessageUuid;
    END;

    -- Likes dekrementieren
    CREATE TRIGGER IF NOT EXISTS trg_like_after_delete
    AFTER DELETE ON tableLike
    BEGIN
      UPDATE tableMessage
      SET likes = CASE WHEN likes > 0 THEN likes - 1 ELSE 0 END
      WHERE uuid = OLD.likeMessageUuid;
    END;

    -- Dislikes inkrementieren
    CREATE TRIGGER IF NOT EXISTS trg_dislike_after_insert
    AFTER INSERT ON tableDislike
    BEGIN
      UPDATE tableMessage
      SET dislikes = dislikes + 1
      WHERE uuid = NEW.dislikeMessageUuid;
    END;

    -- Dislikes dekrementieren
    CREATE TRIGGER IF NOT EXISTS trg_dislike_after_delete
    AFTER DELETE ON tableDislike
    BEGIN
      UPDATE tableMessage
      SET dislikes = CASE WHEN dislikes > 0 THEN dislikes - 1 ELSE 0 END
      WHERE uuid = OLD.dislikeMessageUuid;
    END;

    /* ===== XOR: Like vs. Dislike ===== */

    /* Wenn ein Like gesetzt wird, lösche ggf. das Dislike des gleichen Users/Message */
    CREATE TRIGGER IF NOT EXISTS trg_like_xor_dislike
    AFTER INSERT ON tableLike
    BEGIN
      DELETE FROM tableDislike
      WHERE dislikeMessageUuid = NEW.likeMessageUuid
        AND dislikeUserId    = NEW.likeUserId;
    END;

    /* Wenn ein Dislike gesetzt wird, lösche ggf. das Like des gleichen Users/Message */
    CREATE TRIGGER IF NOT EXISTS trg_dislike_xor_like
    AFTER INSERT ON tableDislike
    BEGIN
      DELETE FROM tableLike
      WHERE likeMessageUuid = NEW.dislikeMessageUuid
        AND likeUserId    = NEW.dislikeUserId;
    END;

    /* =======================
       COMMENTS COUNTER
       ======================= */

    -- 1) Neuer Kommentar: Parent-Zähler ++ (nur wenn der Kommentar enabled ist)
    CREATE TRIGGER IF NOT EXISTS trg_msg_comment_after_insert
    AFTER INSERT ON tableMessage
    WHEN NEW.parentUuid IS NOT NULL AND NEW.status = 'enabled'
    BEGIN
      UPDATE tableMessage
      SET commentsNumber = commentsNumber + 1
      WHERE uuid = NEW.parentUuid;
    END;

    -- 2) Kommentar gelöscht: Parent-Zähler -- (nur wenn der Kommentar enabled war)
    CREATE TRIGGER IF NOT EXISTS trg_msg_comment_after_delete
    AFTER DELETE ON tableMessage
    WHEN OLD.parentUuid IS NOT NULL AND OLD.status = 'enabled'
    BEGIN
      UPDATE tableMessage
      SET commentsNumber = CASE
        WHEN commentsNumber > 0 THEN commentsNumber - 1
        ELSE 0
      END
      WHERE uuid = OLD.parentUuid;
    END;

    -- 3) Kommentar-Status geändert: disabled -> enabled  => ++
    CREATE TRIGGER IF NOT EXISTS trg_msg_comment_after_update_status_enable
    AFTER UPDATE OF status ON tableMessage
    WHEN NEW.parentUuid IS NOT NULL
         AND OLD.status <> 'enabled'
         AND NEW.status = 'enabled'
    BEGIN
      UPDATE tableMessage
      SET commentsNumber = commentsNumber + 1
      WHERE uuid = NEW.parentUuid;
    END;

    -- 4) Kommentar-Status geändert: enabled -> disabled  => --
    CREATE TRIGGER IF NOT EXISTS trg_msg_comment_after_update_status_disable
    AFTER UPDATE OF status ON tableMessage
    WHEN NEW.parentUuid IS NOT NULL
         AND OLD.status = 'enabled'
         AND NEW.status <> 'enabled'
    BEGIN
      UPDATE tableMessage
      SET commentsNumber = CASE
        WHEN commentsNumber > 0 THEN commentsNumber - 1
        ELSE 0
      END
      WHERE uuid = NEW.parentUuid;
    END;

    -- 5) Kommentar wird umgehängt (Parentwechsel): alter-- / neuer++
    CREATE TRIGGER IF NOT EXISTS trg_msg_comment_after_update_parent
    AFTER UPDATE OF parentUuid ON tableMessage
    WHEN (OLD.parentUuid IS NOT NEW.parentUuid) AND NEW.status = 'enabled'
    BEGIN
      -- beim alten Parent dekrementieren (wenn vorhanden)
      UPDATE tableMessage
      SET commentsNumber = CASE
        WHEN commentsNumber > 0 THEN commentsNumber - 1
        ELSE 0
      END
      WHERE uuid = OLD.parentUuid AND OLD.parentUuid IS NOT NULL;

      -- beim neuen Parent inkrementieren (wenn vorhanden)
      UPDATE tableMessage
      SET commentsNumber = commentsNumber + 1
      WHERE uuid = NEW.parentUuid AND NEW.parentUuid IS NOT NULL;
    END;
  `;

    this.db.exec(triggers, (err) => {
      if (err) {
        logger.error('Error creating triggers: ' + err.message);
      } else {
        logger.info('Database triggers initialized.');
      }
    });
  }

  initIndexes(logger = this.logger) {
    const sql = `
    -- === Bestehende Indexe ===
    -- getByPlusCode: nur ENABLED & root (parent IS NULL)
    CREATE INDEX IF NOT EXISTS idx_msg_plus_enabled_root_createdesc
      ON tableMessage(plusCode, createDateTime DESC)
      WHERE status='enabled' AND parentUuid IS NULL;

    -- getByParentUuid: nur ENABLED
    CREATE INDEX IF NOT EXISTS idx_msg_parent_enabled_createdesc
      ON tableMessage(parentUuid, createDateTime DESC)
      WHERE status='enabled';

    -- getByUserId
    CREATE INDEX IF NOT EXISTS idx_msg_user_createdesc
      ON tableMessage(userId, createDateTime DESC);

    -- cleanPublic
    CREATE INDEX IF NOT EXISTS idx_msg_public_delete_parent
      ON tableMessage(deleteDateTime, parentUuid)
      WHERE typ='public';

    -- === Neue/zusätzliche Indexe ===

    -- 1) Häufige Filter (allgemein): parentUuid + status
    --    Nutzt SQLite auch für Queries, die nur auf parent/status filtern.
    CREATE INDEX IF NOT EXISTS idx_msg_parent_status
      ON tableMessage(parentUuid, status);

    -- 2) Geo-Index für Bounding-Box-Abfragen:
    --    - Partial Index nur für aktive Root-Messages (status enabled, parent NULL)
    --    - Reihenfolge: latitude, longitude (Range-Filter) + createDateTime DESC (Sortierung)
    --    -> Sehr gut passend zu: WHERE parentUuid IS NULL AND status='enabled'
    --                             AND latitude BETWEEN ? AND ?
    --                             AND (longitude BETWEEN ... OR ...)
    --                             ORDER BY createDateTime DESC LIMIT ?
    CREATE INDEX IF NOT EXISTS idx_msg_geo_enabled_root_lat_lon_createdesc
      ON tableMessage(latitude, longitude, createDateTime DESC)
      WHERE status='enabled' AND parentUuid IS NULL;

    -- 2b) Neueste aktive Root-Messages:
    --     Unterstützt große Karten-Ausschnitte, bei denen "die neuesten 256"
    --     entscheidend sind. id DESC macht die Sortierung deterministisch, wenn
    --     mehrere Messages in derselben Sekunde erstellt wurden.
    CREATE INDEX IF NOT EXISTS idx_msg_enabled_root_createdesc_iddesc
      ON tableMessage(createDateTime DESC, id DESC)
      WHERE status='enabled' AND parentUuid IS NULL;

    -- 3) Allgemeiner Sortierindex:
    --    Falls andere Abfragen stark auf createDateTime sortieren, kann das helfen.
    CREATE INDEX IF NOT EXISTS idx_msg_created_desc
      ON tableMessage(createDateTime DESC);

    -- Notifications: quick lookups per user & status
    CREATE INDEX IF NOT EXISTS idx_notification_user_status_created
      ON tableNotification(userId, status, createdAt DESC);

    CREATE INDEX IF NOT EXISTS idx_notification_user_created
      ON tableNotification(userId, createdAt DESC);
  `;

    this.db.exec(sql, (err) => {
      if (err) {
        logger.error('Error creating partial indexes: ' + err.message);
      } else {
        logger.info('Partial indexes for messages initialized.');
      }
    });
  }
}

module.exports = Database;
