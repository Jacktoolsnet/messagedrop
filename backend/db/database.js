const path = require('path');
const { DatabaseSync } = require('node:sqlite');
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
    this.logger = logger ?? this.logger;
    return new Promise((resolve, reject) => {
      try {
        this.db = new SqliteCompat(path.join(path.dirname(__filename), 'messagedrop.db'));
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
