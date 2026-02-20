const path = require('path');
const { Worker } = require('worker_threads');
const tableUser = require('./tableUser');
const tableConnect = require('./tableConnect');
const tableContact = require('./tableContact');
const tableContactMessage = require('./tableContactMessage');
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
      run: (params, callback) => {
        this.run(sql, params, callback);
      },
      get: (params, callback) => {
        this.get(sql, params, callback);
      },
      all: (params, callback) => {
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
    this.logger = logger ?? this.logger;
    return new Promise((resolve, reject) => {
      try {
        this.db = new SqliteCompat(path.join(path.dirname(__filename), 'messagedrop.db'), this.logger);
        this.db.exec(`
          PRAGMA journal_mode = WAL;
          PRAGMA synchronous = NORMAL;
          PRAGMA busy_timeout = 5000;
          PRAGMA temp_store = MEMORY;
          PRAGMA wal_autocheckpoint = 1000;
        `, (pragmaErr) => {
          if (pragmaErr) {
            this.logger.error(pragmaErr.message);
          }
        });
        this.db.serialize(() => {
          this.db.run('PRAGMA foreign_keys = ON;', [], (pragmaErr) => {
            if (pragmaErr) {
              this.logger.error(pragmaErr.message);
            }
          });
          tableUser.init(this.db);
          tableConnect.init(this.db);
          tableContact.init(this.db);
          tableContactMessage.init(this.db);
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

          // Trigger initialisieren
          this.initTriggers(this.logger);

          this.initIndexes(this.logger);

          this.db.get('SELECT 1;', (readyErr) => {
            if (readyErr) {
              reject(readyErr);
              return;
            }
            this.logger.info('Connected to the messagedrop SQlite database.');
            resolve();
          });
        });
      } catch (err) {
        this.logger.error('Failed to open SQLite database.', err);
        reject(err);
      }
    });
  };

  close() {
    try {
      this.db?.close((err) => {
        if (err) {
          return;
        }
        this.logger?.info('Close the database connection.');
      });
    } catch (err) {
      this.logger?.error?.(err?.message || err);
    }
  };

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

module.exports = Database
