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
            if (err) {
                throw err;
            }
        });
    } catch (error) {
        throw error;
    }
};

const countVisitor = function (db, callback) {
    try {
        let sql = `
        INSERT INTO ${tableName} (${columnStatisticDate}, ${columnVisitors}) 
        VALUES (date('now'), 1)
        ON CONFLICT(${columnStatisticDate}) DO UPDATE SET ${columnVisitors} = ${columnVisitors} + 1;`;

        db.run(sql, (err) => {
            callback(err)
        });
    } catch (error) {
        throw error;
    }
};

const countMessage = function (db, callback) {
    try {
        let sql = `
        INSERT INTO ${tableName} (${columnStatisticDate}, ${columnMessages}) 
        VALUES (date('now'), 1)
        ON CONFLICT(${columnStatisticDate}) DO UPDATE SET ${columnMessages} = ${columnMessages} + 1;`;

        db.run(sql, (err) => {
            callback(err)
        });
    } catch (error) {
        throw error;
    }
};

const clean = function (db, callback) {
    try {
        let sql = `
        DELETE FROM ${tableName}
        WHERE ${columnStatisticDate} < date('now','-90 days');`;

        db.run(sql, (err) => {
            callback(err)
        });
    } catch (error) {
        throw error;
    }
};

const getAll = function (db, callback) {
    try {
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
    countVisitor,
    countMessage,
    getAll
}