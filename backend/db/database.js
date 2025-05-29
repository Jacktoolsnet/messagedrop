const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const tableUser = require('./tableUser');
const tableConnect = require('./tableConnect');
const tableContact = require('./tableContact');
const tableStatistic = require('./tableStatistic');
const tableMessage = require('./tableMessage');
const tableLike = require('./tableLike');
const tableDislike = require('./tableDislike');
const tablePlace = require('./tablePlace');
const tableGeoStatistic = require('./tableGeoStatistic');
const tableWeatherHistory = require('./tableWeatherHistory');

class Database {

  constructor() {
    this.db;
  }

  init(logger) {
    this.db = new sqlite3.Database(path.join(path.dirname(__filename), 'messagedrop.db'), sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
      if (err) {
        return;
      } else {
        this.db.run('PRAGMA foreign_keys = ON;', [], function (err) {
          if (err) {
            logger.error(err.message);
          }
        });
        tableUser.init(this.db);
        tableConnect.init(this.db);
        tableContact.init(this.db);
        tableStatistic.init(this.db);
        tableMessage.init(this.db);
        tableLike.init(this.db);
        tableDislike.init(this.db);
        tablePlace.init(this.db);
        tableGeoStatistic.init(this.db);
        tableWeatherHistory.init(this.db);
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

}

module.exports = Database