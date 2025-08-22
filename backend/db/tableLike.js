const tableName = 'tableLike';
const columnLikeMessageId = 'likeMessageId';
const columnLikeUserId = 'likeUserId';

const init = function (db) {
    const sql = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      ${columnLikeMessageId} INTEGER NOT NULL,
      ${columnLikeUserId} TEXT NOT NULL,
      PRIMARY KEY (${columnLikeMessageId}, ${columnLikeUserId}),
      FOREIGN KEY (${columnLikeMessageId}) 
        REFERENCES tableMessage (id) 
        ON UPDATE CASCADE ON DELETE CASCADE,
      FOREIGN KEY (${columnLikeUserId}) 
        REFERENCES tableUser (id) 
        ON UPDATE CASCADE ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_like_msg ON ${tableName}(${columnLikeMessageId});
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
const toggleLike = function (db, messageId, userId, callback) {
    db.serialize(() => {
        db.run('BEGIN IMMEDIATE', (bErr) => {
            if (bErr) return callback(bErr);

            const delSql = `
        DELETE FROM tableLike
        WHERE likeMessageId = ? AND likeUserId = ?;
      `;
            db.run(delSql, [messageId, userId], function (delErr) {
                if (delErr) {
                    db.run('ROLLBACK');
                    return callback(delErr);
                }

                const deleted = this.changes > 0;

                const insertIfNeeded = (next) => {
                    if (deleted) return next(null); // war geliked -> jetzt entfernt
                    const insSql = `
            INSERT INTO tableLike (likeMessageId, likeUserId)
            VALUES (?, ?)
            ON CONFLICT(likeMessageId, likeUserId) DO NOTHING;
          `;
                    db.run(insSql, [messageId, userId], (insErr) => {
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
              (SELECT COUNT(*) FROM tableLike    WHERE likeMessageId    = ?) AS likes,
              (SELECT COUNT(*) FROM tableDislike WHERE dislikeMessageId = ?) AS dislikes,
              EXISTS(SELECT 1 FROM tableLike    WHERE likeMessageId=? AND likeUserId=?)      AS likedByUser,
              EXISTS(SELECT 1 FROM tableDislike WHERE dislikeMessageId=? AND dislikeUserId=?) AS dislikedByUser
          `;
                    const params = [messageId, messageId, messageId, userId, messageId, userId];

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
                                liked: !!row.likedByUser,
                                likes: row.likes | 0,
                                dislikedByUser: !!row.dislikedByUser,
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