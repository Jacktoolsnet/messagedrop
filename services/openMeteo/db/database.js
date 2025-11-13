const path = require('path');
const sqlite3 = require('sqlite3').verbose();

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
    this.db = new sqlite3.Database(path.join(path.dirname(__filename), 'openMeteo.db'), sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
      if (err) {
        return;
      } else {
        this.db.run('PRAGMA foreign_keys = ON;', [], (pragmaError) => {
          if (pragmaError) {
            this.logger.error(pragmaError.message);
          }
        });
        tableAirQuality.init(this.db);
        tableWeather.init(this.db);
        tableWeatherHistory.init(this.db);

        // Trigger initialisieren
        this.initTriggers();

        this.initIndexes();

        this.logger.info('Connected to the messagedrop SQlite database.');
      }
    });
  };

  close() {
    this.db?.close((err) => {
      if (err) {
        return;
      }
      this.logger.info('Close the database connection.');
    });
  };

  initTriggers() {

  }

  initIndexes() {

  }

}

module.exports = Database
