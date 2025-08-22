const tableName = 'tableConnect';

const columnConnectId = 'id';
const columnUserId = 'userId';
const columnHint = 'hint';
const columnSignature = 'signature';
const columnEncryptionPublicKey = 'encryptionPublicKey';
const columnSigningPublicKey = "signingPublicKey";
const columnTimeOfCreation = 'timeOfCreation'; // Max. 64 charachters.

const init = function (db) {
    try {
        const sql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
            ${columnConnectId} TEXT PRIMARY KEY NOT NULL, 
            ${columnUserId} TEXT DEFAULT NULL,
            ${columnHint} TEXT DEFAULT NULL,
            ${columnSignature} TEXT NOT NULL,
            ${columnEncryptionPublicKey} TEXT NOT NULL,
            ${columnSigningPublicKey} TEXT NOT NULL, 
            ${columnTimeOfCreation} INTEGER NOT NULL,
            CONSTRAINT FK_USER_ID FOREIGN KEY (${columnUserId}) 
            REFERENCES tableUser (id) 
            ON UPDATE CASCADE ON DELETE CASCADE 
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

const create = function (
    db,
    connectId,
    userId,
    hint,
    encryptionPublicKey,
    signingPublicKey,
    signature,
    callback
) {
    try {
        const sql = `
      INSERT INTO ${tableName} (
        ${columnConnectId},
        ${columnUserId},
        ${columnHint},
        ${columnSignature},
        ${columnEncryptionPublicKey},
        ${columnSigningPublicKey},
        ${columnTimeOfCreation}
      ) VALUES (
        ?, ?, ?, ?, ?, ?, strftime('%s','now')
      );
    `;

        const params = [
            connectId,
            userId,
            hint ?? null,
            signature,
            encryptionPublicKey,
            signingPublicKey
        ];

        db.run(sql, params, function (err) {
            if (err) return callback(err);
        });
    } catch (error) {
        callback(error);
    }
};

const getById = function (db, connectId, callback) {
    try {
        let sql = `
        SELECT * FROM ${tableName}
        WHERE ${columnConnectId} = ?;`;

        db.get(sql, [connectId], (err, row) => {
            callback(err, row);
        });
    } catch (error) {
        throw error;
    }
};

const deleteById = function (db, connectId, callback) {
    try {
        let sql = `
        DELETE FROM ${tableName}
        WHERE ${columnConnectId} = ?;`;

        db.run(sql, [connectId], (err) => {
            if (err) {
                callback(err);
            } else {
                callback(err);
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
        WHERE ${columnTimeOfCreation} < datetime('now','-1 days');`;

        db.run(sql, (err) => {
            callback(err)
        });
    } catch (error) {
        throw error;
    }
};

module.exports = {
    init,
    create,
    getById,
    deleteById,
    clean
}