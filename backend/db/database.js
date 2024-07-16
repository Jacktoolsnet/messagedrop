const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const tableUser = require('./tableUser');
const tableStatistic = require('./tableStatistic');
const tableMessage = require('./tableMessage');
const tableLike = require('./tableLike');
const tableDislike = require('./tableDislike');
const tablePlace = require('./tablePlace');
const tablePlacePlusCode = require('./tablePlacePlusCode');

class Database {

    constructor() {
        this.db;
      }

    init() {
        this.db = new sqlite3.Database(path.join(path.dirname(__filename), 'messagedrop.db'), sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
            if (err) {
              return console.error(err.message);
            } else {
              this.db.run('PRAGMA foreign_keys = ON;', [], function(err) {
                if (err) {
                  console.error(err.message);
                }
              });
              tableUser.init(this.db);
              tableStatistic.init(this.db);
              tableMessage.init(this.db);
              tableLike.init(this.db);
              tableDislike.init(this.db);
              tablePlace.init(this.db);
              tablePlacePlusCode.init(this.db);
              console.log('Connected to the messagedrop SQlite database.');
            }
          });
    };

    close () {
        this.db.close((err) => {
            if (err) {
              return console.error(err.message);
            }
            console.log('Close the database connection.');
          });
    };

}

module.exports = Database