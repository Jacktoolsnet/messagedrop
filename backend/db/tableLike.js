const tableName = 'tableLike';
const columnLikeMessageUuid = 'likeMessageUuid';
const columnLikeUserId = 'likeUserId';

const init = function (db) {
    const sql = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      ${columnLikeMessageUuid} TEXT NOT NULL,
      ${columnLikeUserId} TEXT NOT NULL,
      PRIMARY KEY (${columnLikeMessageUuid}, ${columnLikeUserId}),
      FOREIGN KEY (${columnLikeMessageUuid}) 
        REFERENCES tableMessage (uuid) 
        ON UPDATE CASCADE ON DELETE CASCADE,
      FOREIGN KEY (${columnLikeUserId}) 
        REFERENCES tableUser (id) 
        ON UPDATE CASCADE ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_like_msg ON ${tableName}(${columnLikeMessageUuid});
  `;
    db.exec(sql, (err) => {
        if (err) throw err;
    });
};

function runQuery(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve(this);
        });
    });
}

function getQuery(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row || null);
        });
    });
}

/**
 * Toggle Like:
 *  - Wenn Like existiert: löschen (unlike)
 *  - Sonst: einfügen (like)
 *  -> Trigger kümmern sich um das Aktualisieren von "likes" in tableMessage
 */
const toggleLike = function (db, messageUuid, userId, callback) {
    db.transaction(async (tx) => {
        const delSql = `
        DELETE FROM ${tableName}
        WHERE ${columnLikeMessageUuid} = ? AND ${columnLikeUserId} = ?;
      `;
        const deleteResult = await runQuery(tx, delSql, [messageUuid, userId]);
        const deleted = deleteResult.changes > 0;

        if (!deleted) {
            const insSql = `
            INSERT INTO ${tableName} (${columnLikeMessageUuid}, ${columnLikeUserId})
            VALUES (?, ?)
            ON CONFLICT(${columnLikeMessageUuid}, ${columnLikeUserId}) DO NOTHING;
          `;
            // Hinweis: XOR-Trigger löscht hier ggf. ein vorhandenes Dislike automatisch.
            await runQuery(tx, insSql, [messageUuid, userId]);
        }

        // Aktuellen Zustand ermitteln (Likes/Dislikes + Flags)
        const stateSql = `
            SELECT
              (SELECT COUNT(*) FROM ${tableName} WHERE ${columnLikeMessageUuid} = ?) AS likes,
              (SELECT COUNT(*) FROM tableDislike WHERE dislikeMessageUuid = ?) AS dislikes;`;
        const row = await getQuery(tx, stateSql, [messageUuid, messageUuid]);
        return {
            likes: row.likes | 0,
            dislikes: row.dislikes | 0
        };
    })
        .then((result) => callback(null, result))
        .catch((err) => callback(err));
};

module.exports = {
    init,
    toggleLike,
};
