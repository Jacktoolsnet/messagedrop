/*
statisticDate: One record per date.
visitors: Visitors per day.
messages: Messages per day.
*/

const tableName = 'tableStatistic';

const columnStatisticDate = 'statisticDate';
const columnVisitors = 'visitors';
const columnMessages = 'messages';

const init = function (db) {
    try {
        const sql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
            ${columnStatisticDate} INTEGER UNIQUE NOT NULL, 
            ${columnVisitors} INTEGER DEFAULT 0, 
            ${columnMessages} INTEGER DEFAULT 0
        );`;

        db.run(sql, (err) => {
            if (err){
                throw err;
            }
        });
    } catch (error) {
        throw error;
    }
};

const clean = function (db, callback) {
    try {
        let sql = `
        DELETE FROM ${tableName}
        WHERE ${columnStatisticDate} < datetime('now','-90 days');`;

        db.run(sql, (err) => {
            callback(err)
        });
    } catch (error) {
        throw error;
    }
};

const getAll = function (db, callback) {
    try{
        let sql = `SELECT * FROM ${tableName};`;

        db.all(sql, (err, rows) => {
            callback(err, rows);
        });
    } catch (error) {
        throw error;
    }
};

module.exports = {
    init,
    clean,
    getAll
}