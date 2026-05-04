const tableStickerCategory = require('./tableStickerCategory');
const tableStickerPack = require('./tableStickerPack');
const tableSticker = require('./tableSticker');
const tableStickerSettings = require('./tableStickerSettings');

const ROW_KEY_MAP = new Map(Object.entries({
  packid: 'packId',
  categoryid: 'categoryId',
  previewstickerid: 'previewStickerId',
  sourceprovider: 'sourceProvider',
  sourcereference: 'sourceReference',
  sourcemetadatajson: 'sourceMetadataJson',
  licensenote: 'licenseNote',
  licensefilepath: 'licenseFilePath',
  licensefilename: 'licenseFileName',
  licensefilemimetype: 'licenseFileMimeType',
  assetpath: 'assetPath',
  mimetype: 'mimeType',
  searchvisible: 'searchVisible',
  sortorder: 'sortOrder',
  createdat: 'createdAt',
  updatedat: 'updatedAt',
  deletedat: 'deletedAt',
  packname: 'packName',
  packslug: 'packSlug',
  packstatus: 'packStatus',
  packsearchvisible: 'packSearchVisible',
  categoryname: 'categoryName',
  categoryslug: 'categorySlug',
  categorystatus: 'categoryStatus',
  packcount: 'packCount',
  stickercount: 'stickerCount',
  notfoundstickerid: 'notFoundStickerId',
  notfoundassetpath: 'notFoundAssetPath',
  notfoundassetmimetype: 'notFoundAssetMimeType',
  notfoundlicensefilepath: 'notFoundLicenseFilePath',
  notfoundlicensefilename: 'notFoundLicenseFileName',
  notfoundlicensefilemimetype: 'notFoundLicenseFileMimeType'
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

  if (/^INSERT\s+OR\s+IGNORE\s+INTO\s+tableStickerSettings\b/i.test(prepared)) {
    prepared = prepared.replace(/^INSERT\s+OR\s+IGNORE\s+INTO/i, 'INSERT INTO');
    prepared = `${prepared.replace(/;\s*$/, '')} ON CONFLICT (id) DO NOTHING`;
  }

  return replaceSqlitePlaceholders(prepared);
}

function createDbConfigFromEnv() {
  const connectionString = process.env.STICKER_DATABASE_URL || process.env.DATABASE_URL;
  const sslEnabled = String(process.env.STICKER_DB_SSL || process.env.DB_SSL || '').toLowerCase() === 'true';
  const max = Number(process.env.STICKER_DB_POOL_MAX || process.env.DB_POOL_MAX || 10);

  if (connectionString) {
    return {
      connectionString,
      max: Number.isFinite(max) && max > 0 ? max : 10,
      ssl: sslEnabled ? { rejectUnauthorized: false } : undefined
    };
  }

  return {
    host: process.env.STICKER_DB_HOST || process.env.DB_HOST || 'localhost',
    port: Number(process.env.STICKER_DB_PORT || process.env.DB_PORT || 5432),
    database: process.env.STICKER_DB_NAME || process.env.DB_NAME || 'messagedrop_sticker',
    user: process.env.STICKER_DB_USER || process.env.DB_USER || 'messagedrop',
    password: process.env.STICKER_DB_PASSWORD || process.env.DB_PASSWORD || undefined,
    max: Number.isFinite(max) && max > 0 ? max : 10,
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined
  };
}

class PostgresCompat {
  constructor(config, logger = console) {
    // Lazy require keeps lint/startup errors clear when dependencies have not been installed yet.
    const { Pool } = require('pg');
    this._pool = new Pool(config);
    this._logger = logger ?? console;
    this._closed = false;
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
    if (this._closed) {
      throw new Error('Database connection is closed');
    }
    const prepared = preparePostgresSql(sql);
    if (!prepared) {
      return { rows: [], rowCount: 0 };
    }
    return this._pool.query(prepared, params);
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
        const context = {
          changes: Number(result?.rowCount ?? 0),
          lastID: null
        };
        this._safeInvokeCallback(normalized.callback, null, undefined, context);
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

  serialize(fn) {
    if (typeof fn === 'function') fn();
  }

  close(callback) {
    if (this._closed) {
      this._safeInvokeCallback(callback, null);
      return;
    }
    this._closed = true;
    this._pool.end()
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

      tableStickerCategory.init(this.db);
      tableStickerPack.init(this.db);
      tableSticker.init(this.db);
      tableStickerSettings.init(this.db);

      this.logger.info('Connected to the messagedrop sticker PostgreSQL database.');
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
        this.logger.info('Close the sticker database connection.');
      });
    } catch (err) {
      this.logger.error(err?.message || err);
    }
  }
}

module.exports = Database;
