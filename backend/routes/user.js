require('dotenv').config();
const { encryptJsonWebKey, decryptJsonWebKey, getEncryptionPrivateKey } = require('../utils/keyStore');
const cryptoUtil = require('../utils/cryptoUtils');
const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const uuid = require('uuid');
const security = require('../middleware/security');
const bodyParser = require('body-parser');
const tableUser = require('../db/tableUser');

router.get('/get', [security.checkToken], function (req, res) {
  let response = { 'status': 0, 'rows': [] };
  tableUser.getAll(req.database.db, function (err, rows) {
    if (err) {
      response.status = 500;
      response.error = err;
    } else {
      if (rows.length == 0) {
        response.status = 404;
      } else {
        rows.forEach((row) => {
          response.rows.push(row);
        });
        response.status = 200;
      }
    }
    res.status(response.status).json(response);
  });
});

router.get('/get/:userId', [security.checkToken], function (req, res) {
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

router.post('/hashpin', [security.checkToken, bodyParser.json({ type: 'application/json' })], async function (req, res) {
  let response = { 'status': 0 };

  const pin = await cryptoUtil.decrypt(await getEncryptionPrivateKey(), JSON.parse(req.body.pin));

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

router.post('/create', [security.checkToken, bodyParser.json({ type: 'application/json' })], async function (req, res) {
  const { subtle } = crypto;

  let response = { 'status': 0 };

  // Create userId
  let userId = uuid.v4();

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

router.post('/confirm', [security.checkToken, bodyParser.json({ type: 'application/json', limit: '10mb' })], async function (req, res) {
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
              console.error(err);
              esponse.status = 500;
              response.error = 'Encrption failed';
              res.status(response.status).json(response);
            }
          } catch (err) {
            response.status = 500;
            response.error = 'Encrption failed';
            res.status(response.status).json(response);
          }
        }
      }
    });
  }

});

router.get('/clean', [security.checkToken], function (req, res) {
  let response = { 'status': 0 };
  tableUser.clean(req.database.db, function (err) {
    if (err) {
      response.status = 500;
      response.error = err;
    } else {
      response.status = 200;
    }
    res.status(response.status).json(response);
  });
});

router.get('/delete/:userId', [security.checkToken], function (req, res) {
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

router.post('/subscribe', [security.checkToken, bodyParser.json({ type: 'application/json' })], function (req, res) {
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

router.get('/unsubscribe/:userId', [security.checkToken], function (req, res) {
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