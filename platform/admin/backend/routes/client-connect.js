const express = require('express');
const router = express.Router();
const security = require('../middleware/security');
const { getEncryptionPublicJwk, getSigningPublicJwk } = require('../utils/keyStore');
const { apiError } = require('../middleware/api-error');

router.get('/', [security.checkToken], async (req, res, next) => {
    let response = { 'status': 0 };
    try {
        const encryptionPublicKeyJwk = await getEncryptionPublicJwk();
        const signingPublicKeyJwk = await getSigningPublicJwk();

        if (!encryptionPublicKeyJwk || !signingPublicKeyJwk) {
            return next(apiError.serviceUnavailable('keys_unavailable'));
        }

        // Optional kannst du zusätzlich Informationen mitgeben (z. B. Algorithmusnamen)
        response.status = 200;
        response.cryptoPublicKey = encryptionPublicKeyJwk;
        response.signingPublicKey = signingPublicKeyJwk;
        res.status(200).json(response);
    } catch (err) {
        req.logger?.error('client-connect failed to load keys', { error: err?.message });
        const apiErr = apiError.internal('key_access_failed');
        apiErr.detail = err?.message || err;
        next(apiErr);
    }
});

module.exports = router;
