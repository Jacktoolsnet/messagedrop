const fs = require('fs');
const path = require('path');
const {
    webcrypto,
    createCipheriv,
    createDecipheriv,
    randomBytes,
    scryptSync,
} = require('crypto');
require('dotenv').config();

const { subtle } = webcrypto;

// Dateipfade
const KEYS_DIR = path.join(__dirname, '../keys');
const ENCRYPTION_KEY_PATH = path.join(KEYS_DIR, 'encryption.key.enc');
const SIGNING_KEY_PATH = path.join(KEYS_DIR, 'signing.key.enc');

// Schlüssel im Speicher
let encryptionKey = { publicKey: null, privateKey: null };
let signingKey = { publicKey: null, privateKey: null };

// Hilfsfunktionen zur Verschlüsselung/Entschlüsselung
function getAesKey(password, salt) {
    return scryptSync(password, salt, 32);
}

function encryptData(data, password) {
    const iv = randomBytes(16);
    const salt = randomBytes(16);
    const key = getAesKey(password, salt);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([salt, iv, tag, encrypted]);
}

function decryptData(buffer, password) {
    const salt = buffer.subarray(0, 16);
    const iv = buffer.subarray(16, 32);
    const tag = buffer.subarray(32, 48);
    const encrypted = buffer.subarray(48);
    const key = getAesKey(password, salt);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

// Datei laden oder neuen Key erzeugen
async function loadOrCreateKeyPair(filePath, password, keyType) {
    if (!fs.existsSync(KEYS_DIR)) fs.mkdirSync(KEYS_DIR);

    if (fs.existsSync(filePath)) {
        const encData = fs.readFileSync(filePath);
        const decrypted = decryptData(encData, password);
        const jwk = JSON.parse(decrypted.toString());

        const publicKey = await subtle.importKey(
            'jwk',
            jwk.publicKey,
            keyType === 'encryption'
                ? { name: 'RSA-OAEP', hash: 'SHA-256' }
                : { name: 'ECDSA', namedCurve: 'P-384' },
            true,
            keyType === 'encryption' ? ['encrypt'] : ['verify']
        );

        const privateKey = await subtle.importKey(
            'jwk',
            jwk.privateKey,
            keyType === 'encryption'
                ? { name: 'RSA-OAEP', hash: 'SHA-256' }
                : { name: 'ECDSA', namedCurve: 'P-384' },
            true,
            keyType === 'encryption' ? ['decrypt'] : ['sign']
        );

        return { publicKey, privateKey };
    }

    // Neues Schlüsselpaar erzeugen
    const algorithm =
        keyType === 'encryption'
            ? {
                name: 'RSA-OAEP',
                modulusLength: 4096,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: 'SHA-256',
            }
            : {
                name: 'ECDSA',
                namedCurve: 'P-384',
            };

    const usages = keyType === 'encryption' ? ['encrypt', 'decrypt'] : ['sign', 'verify'];

    const keyPair = await subtle.generateKey(algorithm, true, usages);
    const publicKeyJwk = await subtle.exportKey('jwk', keyPair.publicKey);
    const privateKeyJwk = await subtle.exportKey('jwk', keyPair.privateKey);

    const json = JSON.stringify({ publicKey: publicKeyJwk, privateKey: privateKeyJwk });
    const encrypted = encryptData(Buffer.from(json), password);
    fs.writeFileSync(filePath, encrypted);

    return { publicKey: keyPair.publicKey, privateKey: keyPair.privateKey };
}

// Initialisierung beider Schlüssel
async function generateOrLoadKeypairs() {
    if (!process.env.ENCRYPTION_KEY_PASSWORD || !process.env.SIGNING_KEY_PASSWORD) {
        throw new Error('Missing environment variables for key passwords!');
    }

    encryptionKey = await loadOrCreateKeyPair(
        ENCRYPTION_KEY_PATH,
        process.env.ENCRYPTION_KEY_PASSWORD,
        'encryption'
    );

    signingKey = await loadOrCreateKeyPair(
        SIGNING_KEY_PATH,
        process.env.SIGNING_KEY_PASSWORD,
        'signing'
    );
}

async function encryptJsonWebKey(jwk) {
    if (!encryptionKey.publicKey) throw new Error('Public encryption key not loaded');

    // 1. AES-GCM Key erzeugen
    const aesKey = await subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );

    // 2. JWK serialisieren und verschlüsseln
    const encodedJwk = new TextEncoder().encode(JSON.stringify(jwk));
    const iv = webcrypto.getRandomValues(new Uint8Array(12));

    const encryptedData = await subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        encodedJwk
    );

    // 3. AES-Key exportieren und mit vorhandenen CryptoKey verschlüsseln
    const exportedAesKey = await subtle.exportKey('jwk', aesKey);
    const aesKeyString = JSON.stringify(exportedAesKey);

    const encryptedAesKey = await subtle.encrypt(
        { name: 'RSA-OAEP' },
        encryptionKey.publicKey, // direkt verwenden!
        new TextEncoder().encode(aesKeyString)
    );

    // 4. Zusammensetzen und base64 zurückgeben
    return Buffer.from(JSON.stringify({
        iv: Buffer.from(iv).toString('base64'),
        encryptedData: Buffer.from(encryptedData).toString('base64'),
        encryptedAesKey: Buffer.from(encryptedAesKey).toString('base64')
    })).toString('base64');
}

async function decryptJsonWebKey(base64Package) {
    if (!encryptionKey.privateKey) throw new Error('Private encryption key not loaded');

    // 1. Base64 → JSON → Buffer-Daten extrahieren
    const decodedJson = Buffer.from(base64Package, 'base64').toString('utf-8');
    const { iv, encryptedData, encryptedAesKey } = JSON.parse(decodedJson);

    // 2. RSA entschlüsselt AES-Key (der verschlüsselt als base64 kommt)
    const decryptedAesKeyBuffer = await subtle.decrypt(
        { name: 'RSA-OAEP' },
        encryptionKey.privateKey, // direkt verwenden!
        Buffer.from(encryptedAesKey, 'base64')
    );

    const aesJwk = JSON.parse(new TextDecoder().decode(decryptedAesKeyBuffer));

    // 3. AES-Key importieren
    const aesKey = await subtle.importKey(
        'jwk',
        aesJwk,
        { name: 'AES-GCM' },
        true,
        ['decrypt']
    );

    // 4. Payload entschlüsseln
    const decryptedJwkBuffer = await subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: Buffer.from(iv, 'base64')
        },
        aesKey,
        Buffer.from(encryptedData, 'base64')
    );

    // 5. Zurückgeben als JSON-WebKey
    return JSON.parse(new TextDecoder().decode(decryptedJwkBuffer));
}

async function getEncryptionPublicJwk() {
    return await subtle.exportKey('jwk', encryptionKey.publicKey);
}

async function getSigningPublicJwk() {
    return await subtle.exportKey('jwk', signingKey.publicKey);
}

// Exporte
module.exports = {
    generateOrLoadKeypairs,
    getEncryptionPublicKey: () => encryptionKey.publicKey,
    getEncryptionPrivateKey: () => encryptionKey.privateKey,
    getSigningPublicKey: () => signingKey.publicKey,
    getSigningPrivateKey: () => signingKey.privateKey,
    encryptJsonWebKey,
    decryptJsonWebKey,
    getEncryptionPublicJwk,
    getSigningPublicJwk
};