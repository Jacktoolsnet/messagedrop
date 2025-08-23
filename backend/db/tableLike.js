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

/**
 * Toggle Like:
 *  - Wenn Like existiert: löschen (unlike)
 *  - Sonst: einfügen (like)
 *  -> Trigger kümmern sich um das Aktualisieren von "likes" in tableMessage
 */
const toggleLike = function (db, messageUuid, userId, callback) {
    db.serialize(() => {
        db.run('BEGIN IMMEDIATE', (bErr) => {
            if (bErr) return callback(bErr);

            const delSql = `
        DELETE FROM ${tableName}
        WHERE ${columnLikeMessageUuid} = ? AND ${columnLikeUserId} = ?;
      `;
            db.run(delSql, [messageUuid, userId], function (delErr) {
                if (delErr) {
                    db.run('ROLLBACK');
                    return callback(delErr);
                }

                const deleted = this.changes > 0;

                const insertIfNeeded = (next) => {
                    if (deleted) return next(null); // war geliked -> jetzt entfernt
                    const insSql = `
            INSERT INTO ${tableName} (${columnLikeMessageUuid}, ${columnLikeUserId})
            VALUES (?, ?)
            ON CONFLICT(${columnLikeMessageUuid}, ${columnLikeUserId}) DO NOTHING;
          `;
                    db.run(insSql, [messageUuid, userId], (insErr) => {
                        if (insErr) return next(insErr);
                        // Hinweis: XOR-Trigger löscht hier ggf. ein vorhandenes Dislike automatisch.
                        next(null);
                    });
                };

                insertIfNeeded((insErr) => {
                    if (insErr) {
                        db.run('ROLLBACK');
                        return callback(insErr);
                    }

                    // Aktuellen Zustand ermitteln (Likes/Dislikes + Flags)
                    const stateSql = `
            SELECT
              (SELECT COUNT(*) FROM ${tableName} WHERE ${columnLikeMessageUuid} = ?) AS likes,
              (SELECT COUNT(*) FROM tableDislike WHERE dislikeMessageUuid = ?) AS dislikes;`;
                    const params = [messageUuid, messageUuid];

                    db.get(stateSql, params, (stateErr, row) => {
                        if (stateErr) {
                            db.run('ROLLBACK');
                            return callback(stateErr);
                        }

                        // Commit und Ergebnis zurückgeben
                        db.run('COMMIT', (cErr) => {
                            if (cErr) return callback(cErr);
                            // liked spiegelt den aktuellen Zustand wider (nicht nur die Aktion)
                            const result = {
                                likes: row.likes | 0,
                                dislikes: row.dislikes | 0
                            };
                            callback(null, result);
                        });
                    });
                });
            });
        });
    });
};

module.exports = {
    init,
    toggleLike,
};