const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const tableAirQuality = require('./tableAirQuality');
const tableWeather = require('./tableWeather');

class Database {

  constructor() {
    this.db;
  }

  init(logger) {
    this.db = new sqlite3.Database(path.join(path.dirname(__filename), 'openMeteo.db'), sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
      if (err) {
        return;
      } else {
        this.db.run('PRAGMA foreign_keys = ON;', [], function (err) {
          if (err) {
            logger.error(err.message);
          }
        });
        tableAirQuality.init(this.db);
        tableWeather.init(this.db);

        // Trigger initialisieren
        this.initTriggers(logger);

        this.initIndexes(logger);

        logger.info('Connected to the messagedrop SQlite database.');
      }
    });
  };

  close() {
    this.db.close((err) => {
      if (err) {
        return;
      }
      logger.info('Close the database connection.');
    });
  };

  initTriggers(logger) {

  }

  initIndexes(logger) {

  }

}

module.exports = Database