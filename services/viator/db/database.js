const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const tableViatorCache = require('./tableViatorCache');
const tableViatorDestinations = require('./tableViatorDestinations');


class Database {

  constructor() {
    this.db = null;
    this.logger = console;
  }

  init(logger) {
    this.logger = logger ?? console;
    try {
      this.db = new DatabaseSync(path.join(path.dirname(__filename), 'viator.db'));
      this.db.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA busy_timeout = 5000;
        PRAGMA temp_store = MEMORY;
        PRAGMA wal_autocheckpoint = 1000;
      `);
      this.db.exec('PRAGMA foreign_keys = ON;');

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
      this.db?.close();
      this.logger.info('Close the database connection.');
    } catch (err) {
      this.logger.error(err?.message || err);
    }
  };

  initTriggers() {

  }

  initIndexes() {
    try {
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_viator_dest_parent ON tableViatorDestinations(parentDestinationId);');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_viator_dest_type ON tableViatorDestinations(type);');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_viator_dest_sync ON tableViatorDestinations(syncRunId);');
    } catch (err) {
      this.logger?.warn?.(err?.message || err);
    }
  }

}

module.exports = Database
