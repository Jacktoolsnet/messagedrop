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
 * Toggle Dislike:
 * - Wenn Dislike existiert: löschen (Trigger dekrementiert Zähler)
 * - Sonst: einfügen (Trigger inkrementiert Zähler)
 */
const toggleDislike = function (db, messageUuid, userId, callback) {
    db.transaction(async (tx) => {
        const delSql = `
        DELETE FROM ${tableName}
        WHERE ${columnDislikeMessageUuid} = ? AND ${columnDislikeUserId} = ?;
      `;
        const deleteResult = await runQuery(tx, delSql, [messageUuid, userId]);
        const deleted = deleteResult.changes > 0;

        if (!deleted) {
            const insSql = `
            INSERT INTO ${tableName} (${columnDislikeMessageUuid}, ${columnDislikeUserId})
            VALUES (?, ?)
            ON CONFLICT(${columnDislikeMessageUuid}, ${columnDislikeUserId}) DO NOTHING;
          `;
            // Hinweis: XOR-Trigger löscht hier ggf. ein vorhandenes Like automatisch.
            await runQuery(tx, insSql, [messageUuid, userId]);
        }

        // finalen Zustand (inkl. XOR-Effekt) ermitteln
        const stateSql = `
            SELECT
              (SELECT COUNT(*) FROM tableLike WHERE likeMessageUuid = ?) AS likes,
              (SELECT COUNT(*) FROM ${tableName} WHERE ${columnDislikeMessageUuid} = ?) AS dislikes;`;
        const row = await getQuery(tx, stateSql, [messageUuid, messageUuid]);
        return {
            dislikes: row.dislikes | 0,
            likes: row.likes | 0
        };
    })
        .then((result) => callback(null, result))
        .catch((err) => callback(err));
};

module.exports = {
    init,
    toggleDislike,
};
