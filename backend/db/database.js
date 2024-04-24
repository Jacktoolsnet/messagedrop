const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const tableUser = require('./tableUser')

class Database {

    constructor() {
        this.db;
      }

    init() {
        this.db = new sqlite3.Database(path.join(path.dirname(__filename), 'messagedrop.db'), sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
            if (err) {
              return console.error(err.message);
            }
            tableUser.init(this.db)
            console.log('Connected to the messagedrop SQlite database.');
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