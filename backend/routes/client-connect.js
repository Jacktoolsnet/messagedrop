const express = require('express');
const router = express.Router();
const security = require('../middleware/security');
const metric = require('../middleware/metric');
const { getEncryptionPublicJwk, getSigningPublicJwk } = require('../utils/keyStore');

router.use(security.checkToken);

router.get('/',
    [
        metric.count('clientconnect', { when: 'always', timezone: 'utc', amount: 1 })
    ]
    , async (req, res) => {
        let response = { 'status': 0 };
        try {
            const encryptionPublicKeyJwk = await getEncryptionPublicJwk();
            const signingPublicKeyJwk = await getSigningPublicJwk();

            if (!encryptionPublicKeyJwk || !signingPublicKeyJwk) {
                response.status = 503;
                response.error = 'Keys not available';
                return res.status(503).json(response);
            }

            // Optional kannst du zusätzlich Informationen mitgeben (z. B. Algorithmusnamen)
            response.status = 200;
            response.cryptoPublicKey = encryptionPublicKeyJwk;
            response.signingPublicKey = signingPublicKeyJwk;
            res.status(200).json(response);
        } catch (err) {
            response.status = 500;
            response.error = 'Serverfehler beim Key-Zugriff';
            res.status(500).json(response);
        }
    });

module.exports = router;