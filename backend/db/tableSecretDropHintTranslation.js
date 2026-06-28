const tableName = 'tableSecretDropHintTranslation';

const columnId = 'id';
const columnSecretDropUuid = 'secretDropUuid';
const columnTargetLang = 'targetLang';
const columnSourceText = 'sourceText';
const columnTranslatedText = 'translatedText';
const columnDetectedSourceLang = 'detectedSourceLang';
const columnCreatedAt = 'createdAt';

const init = function (db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      ${columnId} INTEGER PRIMARY KEY AUTOINCREMENT,
      ${columnSecretDropUuid} TEXT NOT NULL,
      ${columnTargetLang} TEXT NOT NULL,
      ${columnSourceText} TEXT NOT NULL,
      ${columnTranslatedText} TEXT NOT NULL,
      ${columnDetectedSourceLang} TEXT DEFAULT NULL,
      ${columnCreatedAt} INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      CONSTRAINT FK_SECRET_DROP_HINT_TRANSLATION_DROP FOREIGN KEY (${columnSecretDropUuid})
        REFERENCES tableSecretDrop (uuid)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
      UNIQUE (${columnSecretDropUuid}, ${columnTargetLang})
    );
    CREATE INDEX IF NOT EXISTS idx_${tableName}_drop_lang
      ON ${tableName} (${columnSecretDropUuid}, ${columnTargetLang});
  `;
  db.exec(sql, (err) => {
    if (err) throw err;
  });
};

const getBySecretDropAndLanguage = function (db, secretDropUuid, targetLang, sourceText, callback) {
  const sql = `
    SELECT * FROM ${tableName}
    WHERE ${columnSecretDropUuid} = ?
      AND ${columnTargetLang} = ?
      AND ${columnSourceText} = ?
    LIMIT 1;`;
  db.get(sql, [secretDropUuid, targetLang, sourceText], (err, row) => callback(err, row || null));
};

const upsert = function (db, secretDropUuid, targetLang, sourceText, translatedText, detectedSourceLang, callback) {
  const sql = `
    INSERT INTO ${tableName} (
      ${columnSecretDropUuid},
      ${columnTargetLang},
      ${columnSourceText},
      ${columnTranslatedText},
      ${columnDetectedSourceLang},
      ${columnCreatedAt}
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(${columnSecretDropUuid}, ${columnTargetLang})
    DO UPDATE SET
      ${columnSourceText} = excluded.${columnSourceText},
      ${columnTranslatedText} = excluded.${columnTranslatedText},
      ${columnDetectedSourceLang} = excluded.${columnDetectedSourceLang},
      ${columnCreatedAt} = excluded.${columnCreatedAt};
  `;
  db.run(sql, [secretDropUuid, targetLang, sourceText, translatedText, detectedSourceLang || null, Math.floor(Date.now() / 1000)], (err) => {
    if (callback) callback(err);
  });
};

const deleteBySecretDropUuid = function (db, secretDropUuid, callback) {
  db.run(`DELETE FROM ${tableName} WHERE ${columnSecretDropUuid} = ?;`, [secretDropUuid], (err) => {
    if (callback) callback(err);
  });
};

module.exports = {
  tableName,
  init,
  getBySecretDropAndLanguage,
  upsert,
  deleteBySecretDropUuid
};
