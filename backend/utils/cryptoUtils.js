const { webcrypto } = require('crypto');
const { subtle } = webcrypto;

/**
 * Verschlüsselt einen Payload mit AES-GCM und schützt den AES-Key per RSA-OAEP
 * @param {CryptoKey} rsaPublicKey - Server-Public-Key (RSA-OAEP)
 * @param {string|Buffer} payload - Klartextdaten
 * @returns {Promise<Object>} CryptoData-kompatibles Objekt
 */
async function encrypt(rsaPublicKey, payload) {
    const iv = webcrypto.getRandomValues(new Uint8Array(12));

    const aesKey = await subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );

    const encodedPayload = typeof payload === 'string'
        ? new TextEncoder().encode(payload)
        : payload;

    const encryptedData = await subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        encodedPayload
    );

    const exportedAesKey = await subtle.exportKey('jwk', aesKey);
    const aesKeyString = JSON.stringify(exportedAesKey);

    const encryptedKey = await subtle.encrypt(
        { name: 'RSA-OAEP' },
        rsaPublicKey,
        new TextEncoder().encode(aesKeyString)
    );

    return {
        iv: JSON.stringify(Buffer.from(iv).toJSON()),
        encryptedData: JSON.stringify(Buffer.from(encryptedData).toJSON()),
        encryptedKey: JSON.stringify(Buffer.from(encryptedKey).toJSON())
    };
}

/**
 * Entschlüsselt ein CryptoData-Objekt und gibt den Klartext zurück
 * @param {CryptoKey} rsaPrivateKey - Server-Private-Key (RSA-OAEP)
 * @param {Object} cryptoData - Objekt mit iv, encryptedKey, encryptedData
 * @returns {Promise<string>} Klartext
 */
async function decrypt(rsaPrivateKey, cryptoData) {
    const iv = Buffer.from(JSON.parse(cryptoData).iv);
    const encryptedKey = Buffer.from(JSON.parse(cryptoData).encryptedKey);
    const encryptedData = Buffer.from(JSON.parse(cryptoData).encryptedData);

    const decryptedAesKeyJson = await subtle.decrypt(
        { name: 'RSA-OAEP' },
        rsaPrivateKey,
        encryptedKey
    );

    const aesJwk = JSON.parse(new TextDecoder().decode(decryptedAesKeyJson));

    const aesKey = await subtle.importKey(
        'jwk',
        aesJwk,
        { name: 'AES-GCM' },
        true,
        ['decrypt']
    );

    const decrypted = await subtle.decrypt(
        {
            name: 'AES-GCM',
            iv
        },
        aesKey,
        encryptedData
    );

    return new TextDecoder().decode(decrypted);
}

module.exports = {
    encrypt,
    decrypt
};