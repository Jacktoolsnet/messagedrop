const express = require('express');
const { getEncryptionPublicKey, getSigningPublicKey } = require('../keyStore');

const router = express.Router();

router.get('/client-connect', async (req, res) => {
    let response = { 'status': 0 };
    try {
        const encryptionPublicKey = getEncryptionPublicKey();
        const signingPublicKey = getSigningPublicKey();

        if (!encryptionPublicKey || !signingPublicKey) {
            response.status = 503;
            response.error = 'Keys not available';
            return res.status(503).json(response);
        }

        // Optional kannst du zusätzlich Informationen mitgeben (z. B. Algorithmusnamen)
        response.status = 200;
        response.encryptionPublicKey = encryptionPublicKey;
        response.signingPublicKey = signingPublicKey;
        res.status(200).json(response);
    } catch (err) {
        response.status = 500;
        response.error = 'Serverfehler beim Key-Zugriff';
        res.status(500).json(response);
    }
});

module.exports = router;