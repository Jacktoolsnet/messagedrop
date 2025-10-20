const notificationStatus = {
    UNREAD: 'unread',
    READ: 'read',
    ARCHIVED: 'archived'
};

const tableName = 'tableNotification';

const columnId = 'id';
const columnUuid = 'uuid';
const columnUserId = 'userId';
const columnTitle = 'title';
const columnBody = 'body';
const columnCategory = 'category';
const columnSource = 'source';
const columnStatus = 'status';
const columnMetadata = 'metadata';
const columnCreatedAt = 'createdAt';
const columnReadAt = 'readAt';

const init = function (db) {
    try {
        const sql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
            ${columnId} INTEGER PRIMARY KEY AUTOINCREMENT,
            ${columnUuid} TEXT NOT NULL UNIQUE,
            ${columnUserId} TEXT NOT NULL,
            ${columnTitle} TEXT NOT NULL,
            ${columnBody} TEXT NOT NULL,
            ${columnCategory} TEXT NOT NULL DEFAULT 'general',
            ${columnSource} TEXT DEFAULT NULL,
            ${columnStatus} TEXT NOT NULL DEFAULT '${notificationStatus.UNREAD}',
            ${columnMetadata} TEXT DEFAULT NULL,
            ${columnCreatedAt} INTEGER NOT NULL DEFAULT (strftime('%s','now')),
            ${columnReadAt} INTEGER DEFAULT NULL,
            CONSTRAINT FK_NOTIFICATION_USER FOREIGN KEY (${columnUserId})
                REFERENCES tableUser (id)
                ON UPDATE CASCADE
                ON DELETE CASCADE
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

const mapRow = function (row) {
    if (!row) {
        return row;
    }
    let metadata = null;
    if (row[columnMetadata]) {
        try {
            metadata = JSON.parse(row[columnMetadata]);
        } catch {
            metadata = null;
        }
    }

    return {
        id: row[columnId],
        uuid: row[columnUuid],
        userId: row[columnUserId],
        title: row[columnTitle],
        body: row[columnBody],
        category: row[columnCategory],
        source: row[columnSource],
        status: row[columnStatus],
        metadata,
        createdAt: row[columnCreatedAt],
        readAt: row[columnReadAt]
    };
};

const create = function (db, notification, callback) {
    try {
        const sql = `
        INSERT INTO ${tableName} (
            ${columnUuid},
            ${columnUserId},
            ${columnTitle},
            ${columnBody},
            ${columnCategory},
            ${columnSource},
            ${columnStatus},
            ${columnMetadata}
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;

        const metadata = notification.metadata ? JSON.stringify(notification.metadata) : null;

        const params = [
            notification.uuid,
            notification.userId,
            notification.title,
            notification.body,
            notification.category || 'general',
            notification.source || null,
            notification.status || notificationStatus.UNREAD,
            metadata
        ];

        db.run(sql, params, function (err) {
            if (err) {
                return callback(err);
            }

            getByUuid(db, notification.uuid, callback);
        });
    } catch (error) {
        callback(error);
    }
};

const getByUuid = function (db, uuid, callback) {
    try {
        const sql = `
        SELECT *
        FROM ${tableName}
        WHERE ${columnUuid} = ?;
        `;

        db.get(sql, [uuid], (err, row) => {
            callback(err, mapRow(row));
        });
    } catch (error) {
        callback(error);
    }
};

const getByUserId = function (db, userId, options, callback) {
    try {
        const { status, limit, offset } = options;
        const params = [userId];
        let statusClause = '';

        if (status && status !== 'all') {
            statusClause = `AND ${columnStatus} = ?`;
            params.push(status);
        }

        const sql = `
        SELECT *
        FROM ${tableName}
        WHERE ${columnUserId} = ?
        ${statusClause}
        ORDER BY ${columnCreatedAt} DESC
        LIMIT ? OFFSET ?;`;

        params.push(limit);
        params.push(offset);

        db.all(sql, params, (err, rows) => {
            if (err) {
                return callback(err);
            }
            callback(null, rows.map(mapRow));
        });
    } catch (error) {
        callback(error);
    }
};

const getByUuids = function (db, uuids, callback) {
    try {
        if (!Array.isArray(uuids) || uuids.length === 0) {
            return callback(null, []);
        }

        const placeholders = uuids.map(() => '?').join(',');
        const sql = `
        SELECT *
        FROM ${tableName}
        WHERE ${columnUuid} IN (${placeholders});
        `;

        db.all(sql, uuids, (err, rows) => {
            if (err) {
                return callback(err);
            }
            callback(null, rows.map(mapRow));
        });
    } catch (error) {
        callback(error);
    }
};

const countByUserIdAndStatus = function (db, userId, status, callback) {
    try {
        const sql = `
        SELECT COUNT(*) AS total
        FROM ${tableName}
        WHERE ${columnUserId} = ?
        AND ${columnStatus} = ?;`;

        db.get(sql, [userId, status], (err, row) => {
            if (err) {
                return callback(err);
            }
            callback(null, row ? row.total : 0);
        });
    } catch (error) {
        callback(error);
    }
};

const markAsRead = function (db, userId, uuid, callback) {
    try {
        const sql = `
        UPDATE ${tableName}
        SET ${columnStatus} = '${notificationStatus.READ}',
            ${columnReadAt} = strftime('%s','now')
        WHERE ${columnUuid} = ?
        AND ${columnUserId} = ?;`;

        db.run(sql, [uuid, userId], function (err) {
            if (err) {
                return callback(err);
            }
            callback(null, this.changes);
        });
    } catch (error) {
        callback(error);
    }
};

const markManyAsRead = function (db, userId, uuids, callback) {
    try {
        if (!Array.isArray(uuids) || uuids.length === 0) {
            return callback(null, 0);
        }

        const placeholders = uuids.map(() => '?').join(',');
        const sql = `
        UPDATE ${tableName}
        SET ${columnStatus} = '${notificationStatus.READ}',
            ${columnReadAt} = strftime('%s','now')
        WHERE ${columnUserId} = ?
        AND ${columnUuid} IN (${placeholders});`;

        db.run(sql, [userId, ...uuids], function (err) {
            if (err) {
                return callback(err);
            }
            callback(null, this.changes);
        });
    } catch (error) {
        callback(error);
    }
};

module.exports = {
    tableName,
    notificationStatus,
    init,
    create,
    getByUuid,
    getByUserId,
    getByUuids,
    countByUserIdAndStatus,
    markAsRead,
    markManyAsRead
};
