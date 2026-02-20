const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const tableAirQuality = require('./tableAirQuality');
const tableWeather = require('./tableWeather');
const tableWeatherHistory = require('./tableWeatherHistory');

class Database {

  constructor() {
    this.db = null;
    this.logger = console;
  }

  init(logger) {
    this.logger = logger ?? console;
    try {
      this.db = new DatabaseSync(path.join(path.dirname(__filename), 'openMeteo.db'));
      this.db.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA busy_timeout = 5000;
        PRAGMA temp_store = MEMORY;
        PRAGMA wal_autocheckpoint = 1000;
      `);
      this.db.exec('PRAGMA foreign_keys = ON;');
      tableAirQuality.init(this.db);
      tableWeather.init(this.db);
      tableWeatherHistory.init(this.db);

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

  }

}

module.exports = Database
