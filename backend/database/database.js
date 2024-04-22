const path = require('path');
const sqlite3 = require('sqlite3').verbose();

class Database {

    constructor() {
        this.db;
      }

    init() {
        this.db = new sqlite3.Database(path.join(__dirname, '../../database/messagedrop.db'), sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
            if (err) {
              return console.error(err.message);
            }
            console.log('Connected to the messagedrop SQlite database.');
          });
    };

    close () {
        db.close((err) => {
            if (err) {
              return console.error(err.message);
            }
            console.log('Close the database connection.');
          });
    };

}


module.exports = Database