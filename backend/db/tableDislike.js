const tableName = 'tableDislike';
const columnDislikeMessageUuid = 'dislikeMessageUuid';
const columnDislikeUserId = 'dislikeUserId';

const init = function (db) {
    const sql = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      ${columnDislikeMessageUuid} TEXT NOT NULL,
      ${columnDislikeUserId} TEXT NOT NULL,
      PRIMARY KEY (${columnDislikeMessageUuid}, ${columnDislikeUserId}),
      FOREIGN KEY (${columnDislikeMessageUuid}) 
        REFERENCES tableMessage (uuid) 
        ON UPDATE CASCADE ON DELETE CASCADE,
      FOREIGN KEY (${columnDislikeUserId}) 
        REFERENCES tableUser (id) 
        ON UPDATE CASCADE ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_dislike_msg ON ${tableName}(${columnDislikeMessageUuid});
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
const toggleDislike = function (db, messageUuid, userId, callback) {
    db.serialize(() => {
        db.run('BEGIN IMMEDIATE', (bErr) => {
            if (bErr) return callback(bErr);

            const delSql = `
        DELETE FROM ${tableName}
        WHERE ${columnDislikeMessageUuid} = ? AND ${columnDislikeUserId} = ?;
      `;
            db.run(delSql, [messageUuid, userId], function (delErr) {
                if (delErr) {
                    db.run('ROLLBACK');
                    return callback(delErr);
                }

                const deleted = this.changes > 0;

                const insertIfNeeded = (next) => {
                    if (deleted) return next(null); // war disliked -> jetzt entfernt
                    const insSql = `
            INSERT INTO ${tableName} (${columnDislikeMessageUuid}, ${columnDislikeUserId})
            VALUES (?, ?)
            ON CONFLICT(${columnDislikeMessageUuid}, ${columnDislikeUserId}) DO NOTHING;
          `;
                    db.run(insSql, [messageUuid, userId], (insErr) => {
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
              (SELECT COUNT(*) FROM tableLike WHERE likeMessageUuid = ?) AS likes,
              (SELECT COUNT(*) FROM ${tableName} WHERE ${columnDislikeMessageUuid} = ?) AS dislikes;`;
                    const params = [messageUuid, messageUuid];

                    db.get(stateSql, params, (stateErr, row) => {
                        if (stateErr) {
                            db.run('ROLLBACK');
                            return callback(stateErr);
                        }

                        db.run('COMMIT', (cErr) => {
                            if (cErr) return callback(cErr);
                            const result = {
                                dislikes: row.dislikes | 0,
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