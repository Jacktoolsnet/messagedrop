const path = require('path');
const { Worker } = require('worker_threads');
const tableViatorCache = require('./tableViatorCache');
const tableViatorDestinations = require('./tableViatorDestinations');

class SqliteCompat {
  constructor(filePath, logger = console) {
    this._logger = logger ?? console;
    this._requestId = 0;
    this._pending = new Map();
    this._closed = false;

    this._worker = new Worker(path.join(__dirname, 'sqlite-worker.js'), {
      workerData: { filePath }
    });

    this._worker.on('message', (message) => this._handleWorkerMessage(message));
    this._worker.on('error', (error) => this._handleWorkerFailure(error));
    this._worker.on('exit', (code) => {
      if (this._closed) {
        return;
      }
      if (code !== 0) {
        this._handleWorkerFailure(new Error(`SQLite worker exited with code ${code}`));
      }
    });
  }

  _safeInvokeCallback(callback, error, value, context = null) {
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
      this._logger?.error?.('SQLite callback failed', callbackError);
    }
  }

  _createError(errorPayload) {
    const error = new Error(errorPayload?.message || 'SQLite worker error');
    if (errorPayload?.name) {
      error.name = errorPayload.name;
    }
    if (errorPayload?.code) {
      error.code = errorPayload.code;
    }
    if (errorPayload?.stack) {
      error.stack = errorPayload.stack;
    }
    return error;
  }

  _handleWorkerFailure(error) {
    const pending = Array.from(this._pending.values());
    this._pending.clear();
    pending.forEach(({ callback }) => {
      this._safeInvokeCallback(callback, error);
    });
  }

  _handleWorkerMessage(message) {
    const { id, ok, result, error } = message || {};
    if (typeof id !== 'number') {
      return;
    }

    const pending = this._pending.get(id);
    if (!pending) {
      return;
    }
    this._pending.delete(id);

    const { action, callback } = pending;
    if (!ok) {
      this._safeInvokeCallback(callback, this._createError(error));
      return;
    }

    if (action === 'run') {
      const context = {
        changes: Number(result?.changes ?? 0),
        lastID: result?.lastID ?? null
      };
      this._safeInvokeCallback(callback, null, undefined, context);
      return;
    }
    if (action === 'get') {
      this._safeInvokeCallback(callback, null, result ?? null);
      return;
    }
    if (action === 'all') {
      this._safeInvokeCallback(callback, null, Array.isArray(result) ? result : []);
      return;
    }
    this._safeInvokeCallback(callback, null, result);
  }

  _dispatch(action, payload, callback) {
    if (this._closed && action !== 'close') {
      this._safeInvokeCallback(callback, new Error('Database connection is closed'));
      return;
    }

    const id = ++this._requestId;
    this._pending.set(id, { action, callback });
    try {
      this._worker.postMessage({ id, action, ...payload });
    } catch (error) {
      this._pending.delete(id);
      this._safeInvokeCallback(callback, error);
    }
  }

  exec(sql, callback) {
    this._dispatch('exec', { sql }, callback);
  }

  _normalizeParams(params, callback) {
    if (typeof params === 'function') {
      return { params: undefined, callback: params };
    }
    return { params, callback };
  }

  _normalizeStatementArgs(args) {
    const values = Array.from(args ?? []);
    let callback;
    if (values.length && typeof values[values.length - 1] === 'function') {
      callback = values.pop();
    }
    if (values.length === 0) {
      return { params: undefined, callback };
    }
    if (values.length === 1) {
      return { params: values[0], callback };
    }
    return { params: values, callback };
  }

  run(sql, params, callback) {
    const normalized = this._normalizeParams(params, callback);
    this._dispatch('run', { sql, params: normalized.params }, normalized.callback);
  }

  get(sql, params, callback) {
    const normalized = this._normalizeParams(params, callback);
    this._dispatch('get', { sql, params: normalized.params }, normalized.callback);
  }

  all(sql, params, callback) {
    const normalized = this._normalizeParams(params, callback);
    this._dispatch('all', { sql, params: normalized.params }, normalized.callback);
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
    this._dispatch('close', {}, (err) => {
      if (err) {
        this._safeInvokeCallback(callback, err);
        return;
      }
      this._worker.terminate()
        .then(() => this._safeInvokeCallback(callback, null))
        .catch((terminateError) => this._safeInvokeCallback(callback, terminateError));
    });
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
      this.db = new SqliteCompat(path.join(path.dirname(__filename), 'viator.db'), this.logger);
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
      this.db.exec('PRAGMA foreign_keys = ON;', (pragmaError) => {
        if (pragmaError) {
          this.logger.error(pragmaError.message);
        }
      });

      tableViatorCache.init(this.db);
      tableViatorDestinations.init(this.db);

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
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_viator_dest_parent ON tableViatorDestinations(parentDestinationId);', (err) => {
      if (err) {
        this.logger?.warn?.(err?.message || err);
      }
    });
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_viator_dest_type ON tableViatorDestinations(type);', (err) => {
      if (err) {
        this.logger?.warn?.(err?.message || err);
      }
    });
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_viator_dest_sync ON tableViatorDestinations(syncRunId);', (err) => {
      if (err) {
        this.logger?.warn?.(err?.message || err);
      }
    });
  }

}

module.exports = Database
