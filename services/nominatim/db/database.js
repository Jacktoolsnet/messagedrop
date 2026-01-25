const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const tableNominatimCache = require('./tableNominatimCache');
const tableGeoSearch = require('./tableGeoSearch');


class Database {

  constructor() {
    this.db = null;
    this.logger = console;
  }

  init(logger) {
    this.logger = logger ?? console;
    try {
      this.db = new DatabaseSync(path.join(path.dirname(__filename), 'nominatim.db'));
      this.db.exec('PRAGMA foreign_keys = ON;');

      tableNominatimCache.init(this.db);
      tableGeoSearch.init(this.db);

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
