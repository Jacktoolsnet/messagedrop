const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const tableUser = require('./tableUser');
const tableDsaSignal = require('./tableDsaSignal');
const tableDsaNotice = require('./tableDsaNotice');
const tableDsaEvidence = require('./tableDsaEvidence');
const tableDsaDecision = require('./tableDsaDecision');
const tableDsaAppeal = require('./tableDsaAppeal');
const tableDsaNotification = require('./tableDsaNotification');
const tableDsaAuditLog = require('./tableDsaAuditLog');
const tableStatistic = require('./tableStatistic');
const tableStatisticSettings = require('./tableStatisticSettings');
const tableLoginOtp = require('./tableLoginOtp');
const tableErrorLog = require('./tableErrorLog');
const tableInfoLog = require('./tableInfoLog');
const tableWarnLog = require('./tableWarnLog');
const tableFrontendErrorLog = require('./tableFrontendErrorLog');
const tablePowLog = require('./tablePowLog');
const tableModerationRequest = require('./tableModerationRequest');


class SqliteCompat {
  constructor(filePath) {
    this._db = new DatabaseSync(filePath);
  }

  exec(sql, callback) {
    try {
      this._db.exec(sql);
      if (callback) callback(null);
    } catch (err) {
      if (callback) return callback(err);
      throw err;
    }
  }

  _normalizeParams(params, callback) {
    if (typeof params === 'function') {
      return { params: undefined, callback: params };
    }
    return { params, callback };
  }

  _runStatement(stmt, params, callback) {
    const result = params === undefined
      ? stmt.run()
      : Array.isArray(params)
        ? stmt.run(...params)
        : stmt.run(params);
    const ctx = {
      changes: result?.changes ?? 0,
      lastID: result?.lastInsertRowid ?? result?.lastID
    };
    if (callback) callback.call(ctx, null);
    return result;
  }

  run(sql, params, callback) {
    const normalized = this._normalizeParams(params, callback);
    try {
      const stmt = this._db.prepare(sql);
      this._runStatement(stmt, normalized.params, normalized.callback);
    } catch (err) {
      if (normalized.callback) return normalized.callback(err);
      throw err;
    }
  }

  get(sql, params, callback) {
    const normalized = this._normalizeParams(params, callback);
    try {
      const stmt = this._db.prepare(sql);
      const row = normalized.params === undefined
        ? stmt.get()
        : Array.isArray(normalized.params)
          ? stmt.get(...normalized.params)
          : stmt.get(normalized.params);
      if (normalized.callback) return normalized.callback(null, row ?? null);
      return row ?? null;
    } catch (err) {
      if (normalized.callback) return normalized.callback(err);
      throw err;
    }
  }

  all(sql, params, callback) {
    const normalized = this._normalizeParams(params, callback);
    try {
      const stmt = this._db.prepare(sql);
      const rows = normalized.params === undefined
        ? stmt.all()
        : Array.isArray(normalized.params)
          ? stmt.all(...normalized.params)
          : stmt.all(normalized.params);
      if (normalized.callback) return normalized.callback(null, rows ?? []);
      return rows ?? [];
    } catch (err) {
      if (normalized.callback) return normalized.callback(err);
      throw err;
    }
  }

  prepare(sql) {
    const stmt = this._db.prepare(sql);
    return {
      run: (params, callback) => {
        try {
          return this._runStatement(stmt, params, callback);
        } catch (err) {
          if (callback) return callback(err);
          throw err;
        }
      },
      get: (params, callback) => {
        try {
          const row = params === undefined
            ? stmt.get()
            : Array.isArray(params)
              ? stmt.get(...params)
              : stmt.get(params);
          if (callback) return callback(null, row ?? null);
          return row ?? null;
        } catch (err) {
          if (callback) return callback(err);
          throw err;
        }
      },
      all: (params, callback) => {
        try {
          const rows = params === undefined
            ? stmt.all()
            : Array.isArray(params)
              ? stmt.all(...params)
              : stmt.all(params);
          if (callback) return callback(null, rows ?? []);
          return rows ?? [];
        } catch (err) {
          if (callback) return callback(err);
          throw err;
        }
      },
      finalize: (callback) => {
        if (callback) callback(null);
      }
    };
  }

  serialize(fn) {
    if (typeof fn === 'function') fn();
  }

  close(callback) {
    try {
      this._db.close();
      if (callback) callback(null);
    } catch (err) {
      if (callback) return callback(err);
      throw err;
    }
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
      this.db = new SqliteCompat(path.join(path.dirname(__filename), 'messagedropAdmin.db'));
      this.db.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA busy_timeout = 5000;
        PRAGMA temp_store = MEMORY;
        PRAGMA wal_autocheckpoint = 1000;
      `, (pragmaError) => {
        if (pragmaError) {
          this.logger.error(pragmaError.message);
        }
      });
      this.db.run('PRAGMA foreign_keys = ON;', [], (pragmaError) => {
        if (pragmaError) {
          this.logger.error(pragmaError.message);
        }
      });
      tableUser.init(this.db);
      tableDsaSignal.init(this.db);
      tableDsaNotice.init(this.db);
      tableDsaEvidence.init(this.db);
      tableDsaDecision.init(this.db);
      tableDsaAppeal.init(this.db);
      tableDsaNotification.init(this.db);
      tableDsaAuditLog.init(this.db);
      tableStatistic.init(this.db);
      tableStatisticSettings.init(this.db);
      tableLoginOtp.init(this.db);
      tableErrorLog.init(this.db);
      tableInfoLog.init(this.db);
      tableWarnLog.init(this.db);
      tableFrontendErrorLog.init(this.db);
      tablePowLog.init(this.db);
      tableModerationRequest.init(this.db);

      // Trigger initialisieren
      this.initTriggers();

      this.initIndexes();

      this.logger.info('Connected to the messagedrop SQlite database.');
    } catch (err) {
      this.logger.error(err?.message || err);
    }
  };

  close() {
    try {
      this.db?.close((err) => {
        if (err) {
          return;
        }
        this.logger.info('Close the database connection.');
      });
    } catch (err) {
      this.logger.error(err?.message || err);
    }
  };

  initTriggers() {

  }

  initIndexes() {

  }

}

module.exports = Database
