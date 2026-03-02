const userStatus = {
    ENABLED: 'enabled',
    DISABLED: 'disabled'
};

const userType = {
    USER: 'user',
    ADMIN: 'admin',
    BUSSINESS: 'business'
}

const tableName = 'tableUser';
const columnUserId = 'id';
const columnCryptoPublicKey = 'cryptoPublicKey';
const columnSigningPublicKey = 'signingPublicKey';
const columnNumberOfMessages = 'numberOfMessages';
const columnNumberOfBlockedMessages = 'numberOfBlockedMessages';
const columnUserStatus = 'userStatus';
const columnLastSignOfLife = 'lastSignOfLife';
const columnSubscription = 'subscription';
const columnType = 'type';
const columnPostingBlocked = 'postingBlocked';
const columnPostingBlockedReason = 'postingBlockedReason';
const columnPostingBlockedAt = 'postingBlockedAt';
const columnPostingBlockedUntil = 'postingBlockedUntil';
const columnPostingBlockedBy = 'postingBlockedBy';
const columnAccountBlockedReason = 'accountBlockedReason';
const columnAccountBlockedAt = 'accountBlockedAt';
const columnAccountBlockedUntil = 'accountBlockedUntil';
const columnAccountBlockedBy = 'accountBlockedBy';

const init = function (db) {
    try {
        const sql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
            ${columnUserId} TEXT PRIMARY KEY NOT NULL, 
            ${columnCryptoPublicKey} TEXT DEFAULT NULL,
            ${columnSigningPublicKey} TEXT DEFAULT NULL, 
            ${columnNumberOfMessages} INTEGER DEFAULT 0,
            ${columnNumberOfBlockedMessages} INTEGER DEFAULT 0,
            ${columnUserStatus} TEXT NOT NULL DEFAULT '${userStatus.ENABLED}',
            ${columnLastSignOfLife} INTEGER NOT NULL,
            ${columnSubscription} TEXT DEFAULT NULL,
            ${columnType} TEXT DEFAULT NULL,
            ${columnPostingBlocked} INTEGER NOT NULL DEFAULT 0,
            ${columnPostingBlockedReason} TEXT DEFAULT NULL,
            ${columnPostingBlockedAt} INTEGER DEFAULT NULL,
            ${columnPostingBlockedUntil} INTEGER DEFAULT NULL,
            ${columnPostingBlockedBy} TEXT DEFAULT NULL,
            ${columnAccountBlockedReason} TEXT DEFAULT NULL,
            ${columnAccountBlockedAt} INTEGER DEFAULT NULL,
            ${columnAccountBlockedUntil} INTEGER DEFAULT NULL,
            ${columnAccountBlockedBy} TEXT DEFAULT NULL
        );`;

        db.run(sql, (err) => {
            if (err) {
                throw err;
            }
        });

        db.run(`CREATE INDEX IF NOT EXISTS idx_user_status ON ${tableName}(${columnUserStatus});`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_user_posting_blocked ON ${tableName}(${columnPostingBlocked});`);

        const ensureColumn = (name, definition) => {
            db.run(`ALTER TABLE ${tableName} ADD COLUMN ${name} ${definition};`, (err) => {
                if (err && !/duplicate column/i.test(String(err.message || ''))) {
                    // ignore migration issue in old installations; table can be recreated in dev
                }
            });
        };

        ensureColumn(columnPostingBlocked, 'INTEGER NOT NULL DEFAULT 0');
        ensureColumn(columnPostingBlockedReason, 'TEXT DEFAULT NULL');
        ensureColumn(columnPostingBlockedAt, 'INTEGER DEFAULT NULL');
        ensureColumn(columnPostingBlockedUntil, 'INTEGER DEFAULT NULL');
        ensureColumn(columnPostingBlockedBy, 'TEXT DEFAULT NULL');
        ensureColumn(columnAccountBlockedReason, 'TEXT DEFAULT NULL');
        ensureColumn(columnAccountBlockedAt, 'INTEGER DEFAULT NULL');
        ensureColumn(columnAccountBlockedUntil, 'INTEGER DEFAULT NULL');
        ensureColumn(columnAccountBlockedBy, 'TEXT DEFAULT NULL');
    } catch (error) {
        throw error;
    }
};

const create = function (
    db,
    userId,
    callback
) {
    try {
        const sql = `
      INSERT INTO ${tableName} (
        ${columnUserId}, 
        ${columnType},
        ${columnLastSignOfLife}
      ) 
      VALUES (?, ?, strftime('%s','now'));
    `;

        const params = [
            userId,
            userType.USER
        ];

        db.run(sql, params, function (err) {
            return callback(err);
        });
    } catch (error) {
        callback(error);
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

const getById = function (db, userId, callback) {
    try {
        let sql = `
        SELECT * FROM ${tableName}
        WHERE ${columnUserId} = ?;`;

        db.get(sql, [userId], (err, row) => {
            callback(err, row);
        });
    } catch (error) {
        throw error;
    }
};

const deleteById = function (db, userId, callback) {
    try {
        let sql = `
        DELETE FROM ${tableName}
        WHERE ${columnUserId} = ?;`;

        db.run(sql, [userId], (err) => {
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
        WHERE DATETIME(${columnLastSignOfLife}) < DATETIME('now','-90 days');`;

        db.run(sql, (err) => {
            callback(err)
        });
    } catch (error) {
        throw error;
    }
};

const subscribe = function (db, userId, subscription, callback) {
    try {
        const sql = `
        UPDATE ${tableName}
        SET ${columnSubscription} = ?
        WHERE ${columnUserId} = ?;`;

        db.run(sql, [subscription, userId], (err) => {
            callback(err);
        });
    } catch (error) {
        throw error;
    }
};

const unsubscribe = function (db, userId, callback) {
    try {
        const sql = `
        UPDATE ${tableName}
        SET ${columnSubscription} = ?
        WHERE ${columnUserId} = ?;`;

        db.run(sql, ['', userId], (err) => {
            callback(err);
        });
    } catch (error) {
        throw error;
    }
};

const updatePublicKeys = function (db, userId, signingPublicKey, cryptoPublicKey, callback) {
    try {
        const sql = `
        UPDATE ${tableName}
        SET ${columnSigningPublicKey} = ?, ${columnCryptoPublicKey} = ?
        WHERE ${columnUserId} = ?;`;

        db.run(sql, [signingPublicKey, cryptoPublicKey, userId], (err) => {
            callback(err);
        });
    } catch (error) {
        throw error;
    }
};

const updatePostingBlock = function (db, userId, opts, callback) {
    const blocked = opts?.blocked ? 1 : 0;
    if (!blocked) {
        const sql = `
        UPDATE ${tableName}
        SET ${columnPostingBlocked} = 0,
            ${columnPostingBlockedReason} = ?,
            ${columnPostingBlockedAt} = NULL,
            ${columnPostingBlockedUntil} = NULL,
            ${columnPostingBlockedBy} = ?
        WHERE ${columnUserId} = ?;`;
        return db.run(sql, [opts?.reason || null, opts?.actor || null, userId], function (err) {
            callback(err, this?.changes > 0);
        });
    }

    const sql = `
    UPDATE ${tableName}
    SET ${columnPostingBlocked} = 1,
        ${columnPostingBlockedReason} = ?,
        ${columnPostingBlockedAt} = ?,
        ${columnPostingBlockedUntil} = ?,
        ${columnPostingBlockedBy} = ?
    WHERE ${columnUserId} = ?;`;
    db.run(sql, [opts?.reason || null, opts?.at || Date.now(), opts?.until || null, opts?.actor || null, userId], function (err) {
        callback(err, this?.changes > 0);
    });
};

const updateAccountBlock = function (db, userId, opts, callback) {
    const blocked = opts?.blocked ? 1 : 0;
    if (!blocked) {
        const sql = `
        UPDATE ${tableName}
        SET ${columnUserStatus} = '${userStatus.ENABLED}',
            ${columnAccountBlockedReason} = ?,
            ${columnAccountBlockedAt} = NULL,
            ${columnAccountBlockedUntil} = NULL,
            ${columnAccountBlockedBy} = ?
        WHERE ${columnUserId} = ?;`;
        return db.run(sql, [opts?.reason || null, opts?.actor || null, userId], function (err) {
            callback(err, this?.changes > 0);
        });
    }

    const sql = `
    UPDATE ${tableName}
    SET ${columnUserStatus} = '${userStatus.DISABLED}',
        ${columnAccountBlockedReason} = ?,
        ${columnAccountBlockedAt} = ?,
        ${columnAccountBlockedUntil} = ?,
        ${columnAccountBlockedBy} = ?
    WHERE ${columnUserId} = ?;`;
    db.run(sql, [opts?.reason || null, opts?.at || Date.now(), opts?.until || null, opts?.actor || null, userId], function (err) {
        callback(err, this?.changes > 0);
    });
};

module.exports = {
    userStatus,
    init,
    create,
    getAll,
    getById,
    deleteById,
    clean,
    subscribe,
    unsubscribe,
    updatePublicKeys,
    updatePostingBlock,
    updateAccountBlock,
    columns: {
        userId: columnUserId,
        userStatus: columnUserStatus,
        postingBlocked: columnPostingBlocked,
        postingBlockedReason: columnPostingBlockedReason,
        postingBlockedAt: columnPostingBlockedAt,
        postingBlockedUntil: columnPostingBlockedUntil,
        postingBlockedBy: columnPostingBlockedBy,
        accountBlockedReason: columnAccountBlockedReason,
        accountBlockedAt: columnAccountBlockedAt,
        accountBlockedUntil: columnAccountBlockedUntil,
        accountBlockedBy: columnAccountBlockedBy
    }
}
