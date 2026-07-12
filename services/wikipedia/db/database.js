const tableWikipediaTileCache = require('./tableWikipediaTileCache');


const DEFAULT_MAX_PENDING_REQUESTS = 1000;

function resolveMaxPendingRequests(rawValue) {
  const parsed = Number.parseInt(String(rawValue ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_PENDING_REQUESTS;
  }
  return parsed;
}

function createQueueOverloadedError(pendingCount, maxPendingRequests) {
  const error = new Error('Wikipedia database queue overloaded');
  error.code = 'DB_QUEUE_OVERLOADED';
  error.status = 503;
  error.statusCode = 503;
  error.errorCode = 'SERVICE_UNAVAILABLE';
  error.detail = { pendingCount, maxPendingRequests };
  return error;
}

const ROW_KEY_MAP = new Map(Object.entries({
  cachekey: 'cacheKey',
  wikipediaplace: 'wikipediaPlace',
  normalizedquery: 'normalizedQuery',
  geodata: 'geoData',
  lastupdate: 'lastUpdate'
}));

function normalizeRow(row) {
  if (!row || typeof row !== 'object') {
    return row;
  }
  const normalized = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[ROW_KEY_MAP.get(key) || key] = value;
  }
  return normalized;
}

function splitSqlStatements(sql) {
  return String(sql || '')
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function replaceSqlitePlaceholders(sql) {
  let index = 0;
  return String(sql || '').replace(/\?/g, () => `$${++index}`);
}

function preparePostgresSql(sql) {
  let prepared = String(sql || '').trim();
  if (!prepared) {
    return prepared;
  }
  if (/^PRAGMA\b/i.test(prepared)) {
    return '';
  }
  return replaceSqlitePlaceholders(prepared);
}

function createDbConfigFromEnv() {
  const connectionString = process.env.WIKIPEDIA_DATABASE_URL || process.env.DATABASE_URL;
  const sslEnabled = String(process.env.WIKIPEDIA_DB_SSL || process.env.DB_SSL || '').toLowerCase() === 'true';
  const max = Number(process.env.WIKIPEDIA_DB_POOL_MAX || process.env.DB_POOL_MAX || 10);

  if (connectionString) {
    return {
      connectionString,
      max: Number.isFinite(max) && max > 0 ? max : 10,
      ssl: sslEnabled ? { rejectUnauthorized: false } : undefined
    };
  }

  return {
    host: process.env.WIKIPEDIA_DB_HOST || process.env.DB_HOST || 'localhost',
    port: Number(process.env.WIKIPEDIA_DB_PORT || process.env.DB_PORT || 5432),
    database: process.env.WIKIPEDIA_DB_NAME || process.env.DB_NAME || 'messagedrop_wikipedia',
    user: process.env.WIKIPEDIA_DB_USER || process.env.DB_USER || 'messagedrop',
    password: process.env.WIKIPEDIA_DB_PASSWORD || process.env.DB_PASSWORD || undefined,
    max: Number.isFinite(max) && max > 0 ? max : 10,
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined
  };
}

class PostgresCompat {
  constructor(config, logger = console) {
    const { Pool } = require('pg');
    this._pool = new Pool(config);
    this._logger = logger ?? console;
    this._closed = false;
    this._activeTasks = new Set();
    this._pendingCount = 0;
    this._maxPendingRequests = resolveMaxPendingRequests(
      process.env.WIKIPEDIA_DB_MAX_PENDING_REQUESTS || process.env.DB_MAX_PENDING_REQUESTS
    );
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
      if (error) {
        this._logger?.error?.(error?.message || error);
      }
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
    if (typeof params === 'function') {
      return { params: [], callback: params };
    }
    return { params: Array.isArray(params) ? params : (params === undefined ? [] : [params]), callback };
  }

  _normalizeStatementArgs(args) {
    const values = Array.from(args ?? []);
    let callback;
    if (values.length && typeof values[values.length - 1] === 'function') {
      callback = values.pop();
    }
    if (values.length === 0) {
      return { params: [], callback };
    }
    if (values.length === 1 && Array.isArray(values[0])) {
      return { params: values[0], callback };
    }
    return { params: values, callback };
  }

  async _query(sql, params = []) {
    return this._trackTask(async () => {
      if (this._closed) {
        throw new Error('Database connection is closed');
      }
      const prepared = preparePostgresSql(sql);
      if (!prepared) {
        return { rows: [], rowCount: 0 };
      }
      return this._pool.query(prepared, params);
    });
  }

  exec(sql, callback) {
    (async () => {
      for (const statement of splitSqlStatements(sql)) {
        await this._query(statement, []);
      }
    })()
      .then(() => this._safeInvokeCallback(callback, null))
      .catch((err) => this._safeInvokeCallback(callback, err));
  }

  run(sql, params, callback) {
    const normalized = this._normalizeParams(params, callback);
    this._query(sql, normalized.params)
      .then((result) => {
        this._safeInvokeCallback(normalized.callback, null, undefined, {
          changes: Number(result?.rowCount ?? 0),
          lastID: null
        });
      })
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
      finalize: (callback) => {
        this._safeInvokeCallback(callback, null);
      }
    };
  }


  _trackTask(task) {
    if (this.isOverloaded()) {
      return Promise.reject(createQueueOverloadedError(this._pendingCount, this._maxPendingRequests));
    }
    this._pendingCount += 1;
    const run = Promise.resolve()
      .then(task)
      .finally(() => {
        this._pendingCount = Math.max(0, this._pendingCount - 1);
        this._activeTasks.delete(run);
      });
    this._activeTasks.add(run);
    return run;
  }

  _createClientCompat(client) {
    const queryClient = async (sql, params = []) => {
      const prepared = preparePostgresSql(sql);
      if (!prepared) {
        return { rows: [], rowCount: 0 };
      }
      return client.query(prepared, params);
    };

    return {
      run: (sql, params, callback) => {
        const normalized = this._normalizeParams(params, callback);
        queryClient(sql, normalized.params)
          .then((result) => {
            this._safeInvokeCallback(normalized.callback, null, undefined, {
              changes: Number(result?.rowCount ?? 0),
              lastID: null
            });
          })
          .catch((err) => this._safeInvokeCallback(normalized.callback, err));
      },
      get: (sql, params, callback) => {
        const normalized = this._normalizeParams(params, callback);
        queryClient(sql, normalized.params)
          .then((result) => this._safeInvokeCallback(normalized.callback, null, normalizeRow(result?.rows?.[0]) || null))
          .catch((err) => this._safeInvokeCallback(normalized.callback, err));
      },
      all: (sql, params, callback) => {
        const normalized = this._normalizeParams(params, callback);
        queryClient(sql, normalized.params)
          .then((result) => this._safeInvokeCallback(normalized.callback, null, (result?.rows || []).map(normalizeRow)))
          .catch((err) => this._safeInvokeCallback(normalized.callback, err));
      },
      exec: (sql, callback) => {
        (async () => {
          for (const statement of splitSqlStatements(sql)) {
            await queryClient(statement, []);
          }
        })()
          .then(() => this._safeInvokeCallback(callback, null))
          .catch((err) => this._safeInvokeCallback(callback, err));
      }
    };
  }

  transaction(callback) {
    if (typeof callback !== 'function') {
      return Promise.reject(new Error('Transaction callback is required'));
    }

    return this._trackTask(async () => {
      if (this._closed) {
        throw new Error('Database connection is closed');
      }
      const client = await this._pool.connect();
      try {
        await client.query('BEGIN');
        const result = await callback(this._createClientCompat(client));
        await client.query('COMMIT');
        return result;
      } catch (err) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackErr) {
          this._logger?.warn?.('Wikipedia PostgreSQL rollback failed', rollbackErr?.message || rollbackErr);
        }
        throw err;
      } finally {
        client.release();
      }
    });
  }

  pendingCount() { return this._pendingCount; }
  maxPendingRequests() { return this._maxPendingRequests; }
  isOverloaded() { return this._pendingCount >= this._maxPendingRequests; }

  serialize(fn) {
    if (typeof fn === 'function') fn();
  }

  close(callback) {
    if (this._closed) {
      this._safeInvokeCallback(callback, null);
      return;
    }
    this._closed = true;
    Promise.allSettled(Array.from(this._activeTasks))
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
    this.logger = logger ?? console;
    try {
      this.db = new PostgresCompat(createDbConfigFromEnv(), this.logger);

      tableWikipediaTileCache.init(this.db);

      this.initTriggers();
      this.initIndexes();

      this.logger.info('Connected to the messagedrop Wikipedia PostgreSQL database.');
    } catch (err) {
      this.logger.error(err?.message || err);
    }
  }

  close() {
    try {
      this.db?.close((err) => {
        if (err) {
          this.logger.error(err?.message || err);
          return;
        }
        this.logger.info('Close the Wikipedia database connection.');
      });
    } catch (err) {
      this.logger.error(err?.message || err);
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

  initTriggers() {

  }

  initIndexes() {

  }
}

module.exports = Database;
