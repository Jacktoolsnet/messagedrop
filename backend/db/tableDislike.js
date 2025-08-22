const tableName = 'tableDislike';
const columnDislikeMessageId = 'dislikeMessageId';
const columnDislikeUserId = 'dislikeUserId';

const init = function (db) {
    const sql = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      ${columnDislikeMessageId} INTEGER NOT NULL,
      ${columnDislikeUserId} TEXT NOT NULL,
      PRIMARY KEY (${columnDislikeMessageId}, ${columnDislikeUserId}),
      FOREIGN KEY (${columnDislikeMessageId}) 
        REFERENCES tableMessage (id) 
        ON UPDATE CASCADE ON DELETE CASCADE,
      FOREIGN KEY (${columnDislikeUserId}) 
        REFERENCES tableUser (id) 
        ON UPDATE CASCADE ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_dislike_msg ON ${tableName}(${columnDislikeMessageId});
  `;
    db.exec(sql, (err) => {
        if (err) throw err;
    });
};

/**
 * Toggle Dislike:
 * - Wenn Dislike existiert: löschen (Trigger dekrementiert Zähler)
 * - Sonst: einfügen (Trigger inkrementiert Zähler)
 */
const toggleDislike = function (db, messageId, userId, callback) {
    db.serialize(() => {
        db.run('BEGIN IMMEDIATE', (bErr) => {
            if (bErr) return callback(bErr);

            const delSql = `
        DELETE FROM tableDislike
        WHERE dislikeMessageId = ? AND dislikeUserId = ?;
      `;
            db.run(delSql, [messageId, userId], function (delErr) {
                if (delErr) {
                    db.run('ROLLBACK');
                    return callback(delErr);
                }

                const deleted = this.changes > 0;

                const insertIfNeeded = (next) => {
                    if (deleted) return next(null); // war disliked -> jetzt entfernt
                    const insSql = `
            INSERT INTO tableDislike (dislikeMessageId, dislikeUserId)
            VALUES (?, ?)
            ON CONFLICT(dislikeMessageId, dislikeUserId) DO NOTHING;
          `;
                    db.run(insSql, [messageId, userId], (insErr) => {
                        if (insErr) return next(insErr);
                        // Hinweis: Dein XOR-Trigger löscht hier ggf. ein vorhandenes Like automatisch.
                        next(null);
                    });
                };

                insertIfNeeded((insErr) => {
                    if (insErr) {
                        db.run('ROLLBACK');
                        return callback(insErr);
                    }

                    // finalen Zustand (inkl. XOR-Effekt) ermitteln
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

                        db.run('COMMIT', (cErr) => {
                            if (cErr) return callback(cErr);
                            const result = {
                                disliked: !!row.dislikedByUser,
                                dislikes: row.dislikes | 0,
                                likedByUser: !!row.likedByUser,
                                likes: row.likes | 0
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
    toggleDislike,
};