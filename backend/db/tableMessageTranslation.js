const tableName = 'tableMessageTranslation';

const columnId = 'id';
const columnMessageUuid = 'messageUuid';
const columnTargetLang = 'targetLang';
const columnSourceText = 'sourceText';
const columnTranslatedText = 'translatedText';
const columnDetectedSourceLang = 'detectedSourceLang';
const columnCreatedAt = 'createdAt';

const init = function (db) {
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        ${columnId} INTEGER PRIMARY KEY AUTOINCREMENT,
        ${columnMessageUuid} TEXT NOT NULL,
        ${columnTargetLang} TEXT NOT NULL,
        ${columnSourceText} TEXT NOT NULL,
        ${columnTranslatedText} TEXT NOT NULL,
        ${columnDetectedSourceLang} TEXT DEFAULT NULL,
        ${columnCreatedAt} INTEGER NOT NULL DEFAULT (strftime('%s','now')),
        CONSTRAINT FK_MESSAGE_TRANSLATION_MESSAGE FOREIGN KEY (${columnMessageUuid})
          REFERENCES tableMessage (uuid)
          ON UPDATE CASCADE
          ON DELETE CASCADE,
        UNIQUE (${columnMessageUuid}, ${columnTargetLang})
      );
      CREATE INDEX IF NOT EXISTS idx_${tableName}_message_lang
        ON ${tableName} (${columnMessageUuid}, ${columnTargetLang});
    `;
    db.exec(sql, (err) => {
      if (err) {
        throw err;
      }
    });

    const triggerSql = `
      CREATE TRIGGER IF NOT EXISTS trg_message_translation_clear_after_update
      AFTER UPDATE OF message ON tableMessage
      WHEN OLD.message IS NOT NEW.message
      BEGIN
        DELETE FROM ${tableName} WHERE ${columnMessageUuid} = NEW.uuid;
      END;
    `;
    db.exec(triggerSql, (err) => {
      if (err) {
        throw err;
      }
    });
  } catch (error) {
    throw error;
  }
};

const getByMessageAndLanguage = function (db, messageUuid, targetLang, sourceText, callback) {
  const sql = `
    SELECT * FROM ${tableName}
    WHERE ${columnMessageUuid} = ?
      AND ${columnTargetLang} = ?
      AND ${columnSourceText} = ?
    LIMIT 1;`;
  db.get(sql, [messageUuid, targetLang, sourceText], (err, row) => {
    callback(err, row || null);
  });
};

const upsert = function (db, messageUuid, targetLang, sourceText, translatedText, detectedSourceLang, callback) {
  const sql = `
    INSERT INTO ${tableName} (
      ${columnMessageUuid},
      ${columnTargetLang},
      ${columnSourceText},
      ${columnTranslatedText},
      ${columnDetectedSourceLang},
      ${columnCreatedAt}
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(${columnMessageUuid}, ${columnTargetLang})
    DO UPDATE SET
      ${columnSourceText} = excluded.${columnSourceText},
      ${columnTranslatedText} = excluded.${columnTranslatedText},
      ${columnDetectedSourceLang} = excluded.${columnDetectedSourceLang},
      ${columnCreatedAt} = excluded.${columnCreatedAt};
  `;
  const createdAt = Math.floor(Date.now() / 1000);
  const params = [
    messageUuid,
    targetLang,
    sourceText,
    translatedText,
    detectedSourceLang || null,
    createdAt
  ];
  db.run(sql, params, (err) => {
    if (callback) {
      callback(err);
    }
  });
};

module.exports = {
  tableName,
  init,
  getByMessageAndLanguage,
  upsert
};
