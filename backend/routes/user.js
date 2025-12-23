require('dotenv').config();
const { encryptJsonWebKey, decryptJsonWebKey, getEncryptionPrivateKey } = require('../utils/keyStore');
const cryptoUtil = require('../utils/cryptoUtils');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const security = require('../middleware/security');
const tableUser = require('../db/tableUser');
const metric = require('../middleware/metric');

router.use(security.checkToken);

function getAuthUserId(req) {
  return req.jwtUser?.userId ?? req.jwtUser?.id ?? null;
}

function ensureSameUser(req, res, userId) {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    res.status(401).json({ status: 401, error: 'unauthorized' });
    return false;
  }
  if (String(authUserId) !== String(userId)) {
    res.status(403).json({ status: 403, error: 'forbidden' });
    return false;
  }
  return true;
}

function queryAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows || []);
    });
  });
}

function queryGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row || null);
    });
  });
}

async function buildUserBackup(db, userId) {
  const [
    userRow,
    messages,
    contacts,
    contactMessages,
    places,
    notifications,
    likes,
    dislikes,
    connects
  ] = await Promise.all([
    queryGet(db, 'SELECT * FROM tableUser WHERE id = ?', [userId]),
    queryAll(db, 'SELECT * FROM tableMessage WHERE userId = ?', [userId]),
    queryAll(db, 'SELECT * FROM tableContact WHERE userId = ?', [userId]),
    queryAll(db, `
      SELECT cm.*
      FROM tableContactMessage cm
      INNER JOIN tableContact c ON c.id = cm.contactId
      WHERE c.userId = ?;
    `, [userId]),
    queryAll(db, 'SELECT * FROM tablePlace WHERE userId = ?', [userId]),
    queryAll(db, 'SELECT * FROM tableNotification WHERE userId = ?', [userId]),
    queryAll(db, 'SELECT * FROM tableLike WHERE likeUserId = ?', [userId]),
    queryAll(db, 'SELECT * FROM tableDislike WHERE dislikeUserId = ?', [userId]),
    queryAll(db, 'SELECT * FROM tableConnect WHERE userId = ?', [userId])
  ]);

  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    userId,
    tables: {
      tableUser: userRow ? [userRow] : [],
      tableMessage: messages,
      tableContact: contacts,
      tableContactMessage: contactMessages,
      tablePlace: places,
      tableNotification: notifications,
      tableLike: likes,
      tableDislike: dislikes,
      tableConnect: connects
    }
  };
}

function runQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this);
    });
  });
}

function normalizeRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows;
}

async function insertRows(db, tableName, columns, rows) {
  const safeRows = normalizeRows(rows);
  if (!safeRows.length) {
    return;
  }

  const placeholders = columns.map(() => '?').join(', ');
  const sql = `INSERT OR IGNORE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders});`;

  for (const row of safeRows) {
    const values = columns.map((column) => (row && row[column] !== undefined ? row[column] : null));
    await runQuery(db, sql, values);
  }
}

async function restoreUserBackup(db, backup) {
  const tables = backup?.tables || {};

  const userColumns = [
    'id',
    'cryptoPrivateKey',
    'cryptoPublicKey',
    'signingPrivateKey',
    'signingPublicKey',
    'numberOfMessages',
    'numberOfBlockedMessages',
    'userStatus',
    'lastSignOfLife',
    'subscription',
    'type'
  ];

  const messageColumns = [
    'id',
    'uuid',
    'parentUuid',
    'typ',
    'createDateTime',
    'deleteDateTime',
    'latitude',
    'longitude',
    'plusCode',
    'message',
    'markerType',
    'style',
    'views',
    'likes',
    'dislikes',
    'commentsNumber',
    'status',
    'userId',
    'multimedia',
    'dsaStatusToken',
    'dsaStatusTokenCreatedAt'
  ];

  const contactColumns = [
    'id',
    'userId',
    'contactUserId',
    'contactUserSigningPublicKey',
    'contactUserEncryptionPublicKey',
    'subscribed',
    'hint',
    'name',
    'lastMessageFrom',
    'lastMessageAt'
  ];

  const contactMessageColumns = [
    'id',
    'messageId',
    'contactId',
    'direction',
    'message',
    'signature',
    'translatedMessage',
    'status',
    'createdAt',
    'readAt',
    'reaction'
  ];

  const placeColumns = [
    'id',
    'userId',
    'name',
    'subscribed',
    'latMin',
    'latMax',
    'lonMin',
    'lonMax'
  ];

  const notificationColumns = [
    'id',
    'uuid',
    'userId',
    'title',
    'body',
    'category',
    'source',
    'status',
    'metadata',
    'createdAt',
    'readAt'
  ];

  const connectColumns = [
    'id',
    'userId',
    'hint',
    'signature',
    'encryptionPublicKey',
    'signingPublicKey',
    'timeOfCreation'
  ];

  const likeColumns = ['likeMessageUuid', 'likeUserId'];
  const dislikeColumns = ['dislikeMessageUuid', 'dislikeUserId'];

  await runQuery(db, 'BEGIN IMMEDIATE');

  try {
    await insertRows(db, 'tableUser', userColumns, tables.tableUser);

    const allMessages = normalizeRows(tables.tableMessage);
    const parentMessages = allMessages.filter((row) => !row?.parentUuid);
    const childMessages = allMessages.filter((row) => row?.parentUuid);

    await insertRows(db, 'tableMessage', messageColumns, parentMessages);
    for (const row of childMessages) {
      if (!row?.parentUuid) {
        continue;
      }
      const parentExists = await queryGet(db, 'SELECT 1 FROM tableMessage WHERE uuid = ? LIMIT 1;', [row.parentUuid]);
      if (!parentExists) {
        continue;
      }
      await insertRows(db, 'tableMessage', messageColumns, [row]);
    }

    const contacts = normalizeRows(tables.tableContact);
    for (const row of contacts) {
      if (!row?.contactUserId) {
        continue;
      }
      const contactUserExists = await queryGet(db, 'SELECT 1 FROM tableUser WHERE id = ? LIMIT 1;', [row.contactUserId]);
      if (!contactUserExists) {
        continue;
      }
      await insertRows(db, 'tableContact', contactColumns, [row]);
    }
    await insertRows(db, 'tablePlace', placeColumns, tables.tablePlace);
    await insertRows(db, 'tableNotification', notificationColumns, tables.tableNotification);
    await insertRows(db, 'tableConnect', connectColumns, tables.tableConnect);

    const contactMessages = normalizeRows(tables.tableContactMessage);
    for (const row of contactMessages) {
      if (!row?.contactId) {
        continue;
      }
      const contactExists = await queryGet(db, 'SELECT 1 FROM tableContact WHERE id = ? LIMIT 1;', [row.contactId]);
      if (!contactExists) {
        continue;
      }
      await insertRows(db, 'tableContactMessage', contactMessageColumns, [row]);
    }

    const likeRows = normalizeRows(tables.tableLike);
    for (const row of likeRows) {
      if (!row?.likeMessageUuid) {
        continue;
      }
      const messageExists = await queryGet(db, 'SELECT 1 FROM tableMessage WHERE uuid = ? LIMIT 1;', [row.likeMessageUuid]);
      if (!messageExists) {
        continue;
      }
      await insertRows(db, 'tableLike', likeColumns, [row]);
    }

    const dislikeRows = normalizeRows(tables.tableDislike);
    for (const row of dislikeRows) {
      if (!row?.dislikeMessageUuid) {
        continue;
      }
      const messageExists = await queryGet(db, 'SELECT 1 FROM tableMessage WHERE uuid = ? LIMIT 1;', [row.dislikeMessageUuid]);
      if (!messageExists) {
        continue;
      }
      await insertRows(db, 'tableDislike', dislikeColumns, [row]);
    }

    await runQuery(db, 'COMMIT');
  } catch (err) {
    await runQuery(db, 'ROLLBACK');
    throw err;
  }
}

const rateLimitDefaults = {
  standardHeaders: true,
  legacyHeaders: false
};

const userCreateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  ...rateLimitDefaults,
  message: { error: 'Too many user create requests, please try again later.' }
});

const userConfirmLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  ...rateLimitDefaults,
  message: { error: 'Too many user confirm requests, please try again later.' }
});

router.get('/get/:userId',
  [
    security.authenticate
  ],
  function (req, res) {
  if (!ensureSameUser(req, res, req.params.userId)) {
    return;
  }
  let response = { 'status': 0 };
  tableUser.getById(req.database.db, req.params.userId, function (err, row) {
    if (err) {
      response.status = 500;
      response.error = err;
    } else {
      if (!row) {
        response.rawUser = {};
        response.status = 404;
      } else {
        response.rawUser = row;
        response.status = 200;
      }
    }
    res.status(response.status).json(response);
  });
});

router.get('/backup/:userId',
  [
    security.authenticate
  ],
  async function (req, res) {
    if (!ensureSameUser(req, res, req.params.userId)) {
      return;
    }

    const response = { status: 0 };

    try {
      const backup = await buildUserBackup(req.database.db, req.params.userId);
      response.status = 200;
      response.backup = backup;
      res.status(200).json(response);
    } catch (err) {
      response.status = 500;
      response.error = err?.message || err;
      res.status(500).json(response);
    }
  });

router.post('/restore',
  [
    express.json({ type: 'application/json', limit: '20mb' })
  ],
  async function (req, res) {
    const backup = req.body?.backup;
    if (!backup || !backup.tables || !backup.userId) {
      return res.status(400).json({ status: 400, error: 'invalid_backup' });
    }

    try {
      await restoreUserBackup(req.database.db, backup);
      res.status(200).json({ status: 200 });
    } catch (err) {
      res.status(500).json({ status: 500, error: err?.message || err });
    }
  });

router.post('/hashpin',
  [
    express.json({ type: 'application/json' })
  ]
  , async function (req, res) {
    let response = { 'status': 0 };

    const pin = await cryptoUtil.decrypt(getEncryptionPrivateKey(), JSON.parse(req.body.pin));

    if (!pin || typeof pin !== 'string' || pin.length !== 6) {
      response.status = 400;
      response.error = 'Invalid PIN';
      return res.status(400).json(response);
    }

    try {
      crypto.scrypt(pin, process.env.PIN_SALT, 64, (err, derivedKey) => {
        if (err) {
          response.status = 500;
          response.error = 'Hashing failed';
          return res.status(500).json(response);
        }

        response.status = 200;
        response.pinHash = derivedKey.toString('hex');
        return res.status(200).json(response);
      });
    } catch (err) {
      response.status = 500;
      response.error = 'Hashing failed';
      return res.status(500).json(err);
    }

  });

router.post('/create',
  [
    userCreateLimit,
    express.json({ type: 'application/json' }),
    metric.count('user.create', { when: 'always', timezone: 'utc', amount: 1 })
  ]
  , async function (req, res) {
    const { subtle } = crypto;

    let response = { 'status': 0 };

    // Create userId
    let userId = crypto.randomUUID();

    // generate crypto key
    const cryptoKeyPair = await subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 4096,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256"
      },
      true,
      ["encrypt", "decrypt"]
    );
    const cryptoPublicKey = await subtle.exportKey("jwk", cryptoKeyPair.publicKey);
    const cryptoPrivateKey = await encryptJsonWebKey(await subtle.exportKey("jwk", cryptoKeyPair.privateKey));

    // generate signing key
    const signingKeyPair = await subtle.generateKey(
      {
        name: "ECDSA",
        namedCurve: "P-384",
      },
      true,
      ["sign", "verify"]
    );

    const signingPublicKey = await subtle.exportKey("jwk", signingKeyPair.publicKey);
    const signingPrivateKey = await encryptJsonWebKey(await subtle.exportKey("jwk", signingKeyPair.privateKey));

    // Create user record
    tableUser.create(req.database.db, userId, JSON.stringify(cryptoPrivateKey), JSON.stringify(signingPrivateKey), function (err) {
      if (err) {
        response.status = 500;
        response.error = err;
      } else {
        response.status = 200;
        response.userId = userId;
        response.cryptoPublicKey = JSON.stringify(cryptoPublicKey);
        response.signingPublicKey = JSON.stringify(signingPublicKey);
      }
      res.status(response.status).json(response);
    });
  });

router.post('/confirm',
  [
    userConfirmLimit,
    express.json({ type: 'application/json' }),
    metric.count('user.confirm', { when: 'always', timezone: 'utc', amount: 1 })
  ]
  , async function (req, res) {
    const secret = process.env.JWT_SECRET;
    const { subtle } = crypto;

    let response = { 'status': 0 };

    if (!req.body.cryptedUser && !req.body.cryptedUser.id && !req.body.cryptedUser.pinHash) {
      response.status = 400;
      res.status(response.status).json(response);
    } else {
      tableUser.getById(req.database.db, req.body.cryptedUser.id, async function (err, row) {
        if (err) {
          response.status = 500;
          response.error = err;
          res.status(response.status).json(response);
        } else {
          if (!row) {
            response.user = {};
            response.status = 404;
            res.status(response.status).json(response);
          } else {
            // Decrypt the cryptoKey
            try {
              const cryptedUser = JSON.parse(req.body.cryptedUser.cryptedUser);
              const encryptionPrivateKey = await decryptJsonWebKey(JSON.parse(row.cryptoPrivateKey));
              // Payload in ArrayBuffer umwandeln
              const payloadBuffer = Buffer.from(JSON.parse(cryptedUser.encryptedKey));
              // RSA Private Key importieren
              const rsaHashedImportParams = {
                name: "RSA-OAEP",
                hash: "SHA-256"
              };

              const privateKey = await subtle.importKey(
                "jwk",
                encryptionPrivateKey,
                rsaHashedImportParams,
                true,
                ["decrypt"]
              );

              // Payload entschlüsseln
              const decryptedPayload = await subtle.decrypt(
                {
                  name: "RSA-OAEP",
                },
                privateKey,
                payloadBuffer
              );

              // Entschlüsselten AES-Schlüssel importieren
              const decryptedKeyString = new TextDecoder().decode(decryptedPayload);
              const aesJwk = JSON.parse(decryptedKeyString);

              const algorithmIdentifier = {
                name: "AES-GCM"
              };

              const cryptoKey = await subtle.importKey(
                'jwk',
                aesJwk,
                algorithmIdentifier,
                true,
                ['encrypt', 'decrypt']
              );

              // Decrypt the data.
              try {
                const payloadBuffer = Buffer.from(JSON.parse(cryptedUser.encryptedData));
                const decryptedPayload = await crypto.subtle.decrypt(
                  {
                    name: 'AES-GCM',
                    iv: Buffer.from(JSON.parse(cryptedUser.iv))
                  },
                  cryptoKey,
                  payloadBuffer,
                );
                let decoder = new TextDecoder('utf-8');
                const user = JSON.parse(decoder.decode(decryptedPayload));

                if (user.pinHash === req.body.pinHash) {
                  tableUser.updatePublicKeys(req.database.db, user.id, JSON.stringify(user.signingKeyPair.publicKey), JSON.stringify(user.cryptoKeyPair.publicKey), function (err) {
                    if (err) {
                      response.status = 500;
                      response.error = err;
                      res.status(response.status).json(response);
                    }
                    else {
                      response.jwt = jwt.sign(
                        { userId: user.id },
                        secret,
                        { expiresIn: '1h' }
                      );
                      response.user = user;
                      response.status = 200;
                      res.status(response.status).json(response);
                    }
                  }
                  );
                } else {
                  response.status = 401;
                  res.status(response.status).json(response);
                }

              } catch (err) {
                response.status = 500;
                response.error = 'Encryption failed';
                req.logger?.error('user decrypt payload failed', { error: err?.message });
                res.status(response.status).json(response);
              }
            } catch (err) {
              response.status = 500;
              response.error = 'Encryption failed';
              req.logger?.error('user decrypt crypto key failed', { error: err?.message });
              res.status(response.status).json(response);
            }
          }
        }
      });
    }

  });

router.get('/delete/:userId',
  [
    security.authenticate,
    metric.count('user.delete', { when: 'always', timezone: 'utc', amount: 1 })
  ]
  , function (req, res) {
    if (!ensureSameUser(req, res, req.params.userId)) {
      return;
    }
    let response = { 'status': 0 };
    tableUser.deleteById(req.database.db, req.params.userId, function (err) {
      if (err) {
        response.status = 500;
        response.error = err;
      } else {
        response.status = 200;
      }
      res.status(response.status).json(response);
    });
  });

router.get('/renewjwt',
  [
    security.authenticate
  ]
  , (req, res) => {
    const secret = process.env.JWT_SECRET;
    const token = jwt.sign(
      { userId: req.jwtUser.id },
      secret,
      { expiresIn: '1h' }
    );

    res.json({ status: 200, token });
  });

router.post('/subscribe',
  [
    security.authenticate,
    express.json({ type: 'application/json' })
  ]
  , function (req, res) {
    let response = { 'status': 0 };
    tableUser.subscribe(req.database.db, req.body.userId, req.body.subscription, function (err) {
      if (err) {
        response.status = 500;
        response.error = err;
      } else {
        response.status = 200;
      }
      res.status(response.status).json(response);
    });
  });

router.get('/unsubscribe/:userId',
  [
    security.authenticate
  ]
  , function (req, res) {
    let response = { 'status': 0 };
    tableUser.unsubscribe(req.database.db, req.params.userId, function (err) {
      if (err) {
        response.status = 500;
        response.error = err;
      } else {
        response.status = 200;
      }
      res.status(response.status).json(response);
    });
  });


module.exports = router
