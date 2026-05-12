const fs = require('fs');
const path = require('path');
const tableUser = require('./tableUser');
const tableDsaSignal = require('./tableDsaSignal');
const tableDsaNotice = require('./tableDsaNotice');
const tableDsaEvidence = require('./tableDsaEvidence');
const tableDsaDecision = require('./tableDsaDecision');
const tableDsaAppeal = require('./tableDsaAppeal');
const tableDsaNotification = require('./tableDsaNotification');
const tableDsaTextBlock = require('./tableDsaTextBlock');
const tableDsaAuditLog = require('./tableDsaAuditLog');
const tableDsaAiAssessment = require('./tableDsaAiAssessment');
const tableStatistic = require('./tableStatistic');
const tableStatisticSettings = require('./tableStatisticSettings');
const tableAiSettings = require('./tableAiSettings');
const tableAiUsageEvent = require('./tableAiUsageEvent');
const tableLoginOtp = require('./tableLoginOtp');
const tableErrorLog = require('./tableErrorLog');
const tableInfoLog = require('./tableInfoLog');
const tableWarnLog = require('./tableWarnLog');
const tableFrontendErrorLog = require('./tableFrontendErrorLog');
const tablePowLog = require('./tablePowLog');
const tableModerationRequest = require('./tableModerationRequest');
const tableModerationState = require('./tableModerationState');
const tablePublicProfile = require('./tablePublicProfile');
const tablePublicContent = require('./tablePublicContent');
const tableCertificateHealth = require('./tableCertificateHealth');


const DEFAULT_MAX_PENDING_REQUESTS = 1000;

function resolveMaxPendingRequests(rawValue) {
  const parsed = Number.parseInt(String(rawValue ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_PENDING_REQUESTS;
  }
  return parsed;
}

function createQueueOverloadedError(pendingCount, maxPendingRequests) {
  const error = new Error('Admin database queue overloaded');
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
    // Best-effort only. Lower-case row keys are still returned when no mapping is known.
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
  if (!prepared) return prepared;
  if (/^PRAGMA\b/i.test(prepared)) return '';

  prepared = prepared.replace(/\s+COLLATE\s+NOCASE\b/gi, '');
  prepared = prepared.replace(/\bINTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT\b/gi, 'BIGSERIAL PRIMARY KEY');
  prepared = prepared.replace(/\bINTEGER\b/g, 'BIGINT');
  prepared = prepared.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');
  prepared = prepared.replace(/INSERT\s+OR\s+REPLACE\s+INTO/gi, 'INSERT INTO');
  prepared = prepared.replace(/strftime\('\%s','now'\)/gi, 'EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::BIGINT');

  if (/^INSERT\s+INTO\b/i.test(prepared) && /\bOR\s+IGNORE\b/i.test(String(sql || '')) && !/\bON\s+CONFLICT\b/i.test(prepared)) {
    prepared = `${prepared.replace(/;\s*$/, '')} ON CONFLICT DO NOTHING`;
  }

  return replaceSqlitePlaceholders(prepared);
}

function createDbConfigFromEnv() {
  const connectionString = process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL;
  const sslEnabled = String(process.env.ADMIN_DB_SSL || process.env.DB_SSL || '').toLowerCase() === 'true';
  const max = Number(process.env.ADMIN_DB_POOL_MAX || process.env.DB_POOL_MAX || 10);

  if (connectionString) {
    return {
      connectionString,
      max: Number.isFinite(max) && max > 0 ? max : 10,
      ssl: sslEnabled ? { rejectUnauthorized: false } : undefined
    };
  }

  return {
    host: process.env.ADMIN_DB_HOST || process.env.DB_HOST || 'localhost',
    port: Number(process.env.ADMIN_DB_PORT || process.env.DB_PORT || 5432),
    database: process.env.ADMIN_DB_NAME || process.env.DB_NAME || 'messagedrop_admin',
    user: process.env.ADMIN_DB_USER || process.env.DB_USER || 'messagedrop',
    password: process.env.ADMIN_DB_PASSWORD || process.env.DB_PASSWORD || undefined,
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
    this._serialChain = Promise.resolve();
    this._serialMode = false;
    this._activeTasks = new Set();
    this._pendingCount = 0;
    this._maxPendingRequests = resolveMaxPendingRequests(
      process.env.ADMIN_DB_MAX_PENDING_REQUESTS || process.env.DB_MAX_PENDING_REQUESTS
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
    const run = (this._serialMode
      ? this._serialChain.then(task, task)
      : Promise.resolve().then(task)
    ).finally(() => {
      this._pendingCount = Math.max(0, this._pendingCount - 1);
      this._activeTasks.delete(run);
    });
    this._activeTasks.add(run);
    if (this._serialMode) {
      this._serialChain = run.catch(() => {});
    }
    return run;
  }

  _createClientCompat(client) {
    const queryClient = async (sql, params = []) => {
      const tableInfo = await this._tableInfo(sql);
      if (tableInfo) return { rows: tableInfo, rowCount: tableInfo.length };
      const prepared = preparePostgresSql(sql);
      if (!prepared) return { rows: [], rowCount: 0 };
      return client.query(prepared, params);
    };

    return {
      run: (sql, params, callback) => {
        const normalized = this._normalizeParams(params, callback);
        queryClient(sql, normalized.params)
          .then((result) => this._safeInvokeCallback(normalized.callback, null, undefined, {
            changes: Number(result?.rowCount ?? 0),
            lastID: result?.rows?.[0]?.id ?? null
          }))
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
      }
    };
  }

  transaction(callback) {
    if (typeof callback !== 'function') {
      return Promise.reject(new Error('Transaction callback is required'));
    }

    return this._enqueue(async () => {
      if (this._closed) throw new Error('Database connection is closed');
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
          this._logger?.warn?.('Admin PostgreSQL rollback failed', rollbackErr?.message || rollbackErr);
        }
        throw err;
      } finally {
        client.release();
      }
    });
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

  async _queryNow(sql, params = []) {
    if (this._closed) throw new Error('Database connection is closed');

    const tableInfo = await this._tableInfo(sql);
    if (tableInfo) return { rows: tableInfo, rowCount: tableInfo.length };

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

  serialize(fn) {
    if (typeof fn !== 'function') return;
    const previous = this._serialMode;
    this._serialMode = true;
    try {
      fn();
    } finally {
      this._serialMode = previous;
    }
  }

  beginSerialExecution() {
    this._serialMode = true;
  }

  endSerialExecution() {
    this._serialMode = false;
  }

  pendingCount() { return this._pendingCount; }
  maxPendingRequests() { return this._maxPendingRequests; }
  isOverloaded() { return this._pendingCount >= this._maxPendingRequests; }

  close(callback) {
    if (this._closed) {
      this._safeInvokeCallback(callback, null);
      return;
    }
    this._closed = true;
    Promise.allSettled(Array.from(this._activeTasks))
      .then(() => this._serialChain)
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
      this.db.beginSerialExecution();
      tableUser.init(this.db);
      tableDsaSignal.init(this.db);
      tableDsaNotice.init(this.db);
      tableDsaEvidence.init(this.db);
      tableDsaDecision.init(this.db);
      tableDsaAppeal.init(this.db);
      tableDsaNotification.init(this.db);
      tableDsaTextBlock.init(this.db);
      tableDsaAuditLog.init(this.db);
      tableDsaAiAssessment.init(this.db);
      tableStatistic.init(this.db);
      tableStatisticSettings.init(this.db);
      tableAiSettings.init(this.db);
      tableAiUsageEvent.init(this.db);
      tableLoginOtp.init(this.db);
      tableErrorLog.init(this.db);
      tableInfoLog.init(this.db);
      tableWarnLog.init(this.db);
      tableFrontendErrorLog.init(this.db);
      tablePowLog.init(this.db);
      tableModerationRequest.init(this.db);
      tableModerationState.init(this.db);
      tablePublicProfile.init(this.db);
      tablePublicContent.init(this.db);
      tableCertificateHealth.init(this.db);
      this.initTriggers();
      this.initIndexes();
      this.db.get('SELECT 1;', (readyErr) => {
        this.db.endSerialExecution();
        if (readyErr) {
          this.logger.error(readyErr?.message || readyErr);
          return;
        }
        this.logger.info('Connected to the messagedrop Admin PostgreSQL database.');
      });

    } catch (err) {
      this.db?.endSerialExecution?.();
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

  close() {
    try {
      this.db?.close((err) => {
        if (err) {
          this.logger.error(err?.message || err);
          return;
        }
        this.logger.info('Close the Admin database connection.');
      });
    } catch (err) {
      this.logger.error(err?.message || err);
    }
  }

  initTriggers() {

  }

  initIndexes() {

  }
}

module.exports = Database;
