require('dotenv').config();
const { getEncryptionPrivateKey } = require('../utils/keyStore');
const cryptoUtil = require('../utils/cryptoUtils');
const crypto = require('crypto');
const { webcrypto } = crypto;
const { subtle } = webcrypto;
const jwt = require('jsonwebtoken');
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const security = require('../middleware/security');
const tableUser = require('../db/tableUser');
const metric = require('../middleware/metric');
const { apiError } = require('../middleware/api-error');

function getAuthUserId(req) {
  return req.jwtUser?.userId ?? req.jwtUser?.id ?? null;
}

function ensureSameUser(req, res, userId, next) {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    if (next) {
      next(apiError.unauthorized('unauthorized'));
    } else {
      res.status(401).json({ status: 401, error: 'unauthorized' });
    }
    return false;
  }
  if (String(authUserId) !== String(userId)) {
    if (next) {
      next(apiError.forbidden('forbidden'));
    } else {
      res.status(403).json({ status: 403, error: 'forbidden' });
    }
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

const loginChallenges = new Map();
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function issueLoginChallenge(userId) {
  const challenge = crypto.randomBytes(32).toString('base64url');
  loginChallenges.set(String(userId), {
    challenge,
    expiresAt: Date.now() + CHALLENGE_TTL_MS
  });
  return challenge;
}

function validateLoginChallenge(userId, challenge) {
  const key = String(userId);
  const entry = loginChallenges.get(key);
  if (!entry) {
    return false;
  }
  if (Date.now() > entry.expiresAt) {
    loginChallenges.delete(key);
    return false;
  }
  const matches = entry.challenge === challenge;
  if (matches) {
    loginChallenges.delete(key);
  }
  return matches;
}

async function verifySignedChallenge(signingPublicKey, challenge, signature) {
  const payloadBuffer = Buffer.from(challenge);
  let signatureBuffer;
  try {
    signatureBuffer = Buffer.from(JSON.parse(signature));
  } catch {
    return false;
  }
  const publicKey = await subtle.importKey(
    'jwk',
    signingPublicKey,
    { name: 'ECDSA', namedCurve: 'P-384' },
    true,
    ['verify']
  );
  return await subtle.verify(
    { name: 'ECDSA', hash: 'SHA-384' },
    publicKey,
    signatureBuffer,
    payloadBuffer
  );
}

const rateLimitDefaults = {
  standardHeaders: true,
  legacyHeaders: false
};

const rateLimitMessage = (message) => ({
  errorCode: 'RATE_LIMIT',
  message,
  error: message
});

const userCreateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many user create requests, please try again later.')
});

const userConfirmLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  ...rateLimitDefaults,
  message: rateLimitMessage('Too many user auth requests, please try again later.')
});

router.get('/get/:userId',
  [
    security.authenticate
  ],
  function (req, res, next) {
  if (!ensureSameUser(req, res, req.params.userId, next)) {
    return;
  }
  tableUser.getById(req.database.db, req.params.userId, function (err, row) {
    if (err) {
      return next(apiError.internal('db_error'));
    }
    if (!row) {
      return next(apiError.notFound('not_found'));
    }
    res.status(200).json({ status: 200, rawUser: row });
  });
});

router.get('/backup/:userId',
  [
    security.authenticate
  ],
  async function (req, res, next) {
    if (!ensureSameUser(req, res, req.params.userId, next)) {
      return;
    }

    try {
      const backup = await buildUserBackup(req.database.db, req.params.userId);
      res.status(200).json({ status: 200, backup });
    } catch (err) {
      next(apiError.internal('backup_failed'));
    }
  });

router.post('/restore',
  [
    security.authenticate,
    express.json({ type: 'application/json', limit: '20mb' })
  ],
  async function (req, res, next) {
    const backup = req.body?.backup;
    if (!backup || !backup.tables || !backup.userId) {
      return next(apiError.badRequest('invalid_backup'));
    }
    if (!ensureSameUser(req, res, backup.userId, next)) {
      return;
    }

    try {
      await restoreUserBackup(req.database.db, backup);
      res.status(200).json({ status: 200 });
    } catch (err) {
      next(apiError.internal('restore_failed'));
    }
  });

router.post('/hashpin',
  [
    express.json({ type: 'application/json' })
  ]
  , async function (req, res, next) {
    const pin = await cryptoUtil.decrypt(getEncryptionPrivateKey(), JSON.parse(req.body.pin));

    if (!pin || typeof pin !== 'string' || pin.length !== 6) {
      return next(apiError.badRequest('invalid_pin'));
    }

    try {
      crypto.scrypt(pin, process.env.PIN_SALT, 64, (err, derivedKey) => {
        if (err) {
          return next(apiError.internal('hashing_failed'));
        }

        return res.status(200).json({ status: 200, pinHash: derivedKey.toString('hex') });
      });
    } catch (err) {
      return next(apiError.internal('hashing_failed'));
    }

  });

router.post('/create',
  [
    userCreateLimit,
    express.json({ type: 'application/json' }),
    metric.count('user.create', { when: 'always', timezone: 'utc', amount: 1 })
  ]
  , function (req, res, next) {
    const userId = crypto.randomUUID();

    tableUser.create(req.database.db, userId, function (err) {
      if (err) {
        return next(apiError.internal('db_error'));
      }
      res.status(200).json({
        status: 200,
        userId
      });
    });
  });

router.post('/register',
  [
    userConfirmLimit,
    express.json({ type: 'application/json' }),
    metric.count('user.register', { when: 'always', timezone: 'utc', amount: 1 })
  ]
  , function (req, res, next) {
    const { userId, signingPublicKey, cryptoPublicKey } = req.body ?? {};

    if (!userId || !signingPublicKey || !cryptoPublicKey) {
      return next(apiError.badRequest('invalid_request'));
    }

    tableUser.getById(req.database.db, userId, function (err, row) {
      if (err) {
        return next(apiError.internal('db_error'));
      }
      if (!row) {
        return next(apiError.notFound('not_found'));
      }
      if (row.signingPublicKey || row.cryptoPublicKey) {
        return next(apiError.conflict('already_registered'));
      }

      const signingKeyValue = typeof signingPublicKey === 'string'
        ? signingPublicKey
        : JSON.stringify(signingPublicKey);
      const cryptoKeyValue = typeof cryptoPublicKey === 'string'
        ? cryptoPublicKey
        : JSON.stringify(cryptoPublicKey);

      tableUser.updatePublicKeys(req.database.db, userId, signingKeyValue, cryptoKeyValue, function (updateErr) {
        if (updateErr) {
          return next(apiError.internal('db_error'));
        }
        res.status(200).json({ status: 200 });
      });
    });
  });

router.post('/challenge',
  [
    userConfirmLimit,
    express.json({ type: 'application/json' }),
    metric.count('user.challenge', { when: 'always', timezone: 'utc', amount: 1 })
  ]
  , async function (req, res, next) {
    const { userId } = req.body ?? {};
    if (!userId) {
      return next(apiError.badRequest('invalid_request'));
    }

    try {
      const row = await queryGet(req.database.db, 'SELECT signingPublicKey FROM tableUser WHERE id = ?;', [userId]);
      if (!row) {
        return next(apiError.notFound('not_found'));
      }
      if (!row.signingPublicKey) {
        return next(apiError.conflict('missing_public_key'));
      }

      const challenge = issueLoginChallenge(userId);
      res.status(200).json({ status: 200, challenge });
    } catch (err) {
      return next(apiError.internal('db_error'));
    }
  });

router.post('/login',
  [
    userConfirmLimit,
    express.json({ type: 'application/json' }),
    metric.count('user.login', { when: 'always', timezone: 'utc', amount: 1 })
  ]
  , async function (req, res, next) {
    const secret = process.env.JWT_SECRET;
    const { userId, challenge, signature } = req.body ?? {};

    if (!userId || !challenge || !signature) {
      return next(apiError.badRequest('invalid_request'));
    }

    try {
      const row = await queryGet(req.database.db, 'SELECT signingPublicKey FROM tableUser WHERE id = ?;', [userId]);
      if (!row) {
        return next(apiError.notFound('not_found'));
      }
      if (!row.signingPublicKey) {
        return next(apiError.conflict('missing_public_key'));
      }
      if (!validateLoginChallenge(userId, challenge)) {
        return next(apiError.unauthorized('unauthorized'));
      }

      let signingPublicKey;
      try {
        signingPublicKey = JSON.parse(row.signingPublicKey);
      } catch (err) {
        return next(apiError.internal('invalid_public_key'));
      }

      let verified = false;
      try {
        verified = await verifySignedChallenge(signingPublicKey, challenge, signature);
      } catch (err) {
        req.logger?.error('user signature verification failed', { error: err?.message });
        return next(apiError.internal('signature_failed'));
      }

      if (!verified) {
        return next(apiError.unauthorized('unauthorized'));
      }

      await runQuery(req.database.db, `UPDATE tableUser SET lastSignOfLife = strftime('%s','now') WHERE id = ?;`, [userId]);

      const token = jwt.sign(
        { userId },
        secret,
        { expiresIn: '1h' }
      );

      res.status(200).json({ status: 200, jwt: token });
    } catch (err) {
      return next(apiError.internal('db_error'));
    }
  });

router.get('/delete/:userId',
  [
    security.authenticate,
    metric.count('user.delete', { when: 'always', timezone: 'utc', amount: 1 })
  ]
  , function (req, res, next) {
    if (!ensureSameUser(req, res, req.params.userId, next)) {
      return;
    }
    tableUser.deleteById(req.database.db, req.params.userId, function (err) {
      if (err) {
        return next(apiError.internal('db_error'));
      }
      res.status(200).json({ status: 200 });
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
  , function (req, res, next) {
    if (!ensureSameUser(req, res, req.body.userId, next)) {
      return;
    }
    tableUser.subscribe(req.database.db, req.body.userId, req.body.subscription, function (err) {
      if (err) {
        return next(apiError.internal('db_error'));
      }
      res.status(200).json({ status: 200 });
    });
  });

router.get('/unsubscribe/:userId',
  [
    security.authenticate
  ]
  , function (req, res, next) {
    if (!ensureSameUser(req, res, req.params.userId, next)) {
      return;
    }
    tableUser.unsubscribe(req.database.db, req.params.userId, function (err) {
      if (err) {
        return next(apiError.internal('db_error'));
      }
      res.status(200).json({ status: 200 });
    });
  });


module.exports = router
