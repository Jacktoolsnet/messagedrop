import { Injectable } from '@angular/core';
import { Buffer } from 'buffer';
import { CryptoData } from '../interfaces/crypto-data';
import { Keypair } from '../interfaces/keypair';
import { PinEncryptedPayload } from '../interfaces/pin-encrypted-payload';

@Injectable({
  providedIn: 'root'
})
export class CryptoService {

  // https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API

  async createSymmetricalKey(): Promise<JsonWebKey> {
    const symmetricalKey = await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );
    return await crypto.subtle.exportKey("jwk", symmetricalKey);
  }

  async createEncryptionKey(): Promise<Keypair> {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 4096,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256"
      },
      true,
      ["encrypt", "decrypt"]
    );
    const publicKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    const privateKey = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
    const keypair: Keypair = { publicKey, privateKey };
    return keypair;
  }

  async createSigningKey(): Promise<Keypair> {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "ECDSA",
        namedCurve: "P-384",
      },
      true,
      ["sign", "verify"],
    );
    const publicKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    const privateKey = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
    const keypair: Keypair = { publicKey, privateKey };
    return keypair;
  }

  async createSignature(privateSigningKey: JsonWebKey, payload: string): Promise<string> {
    let signature: ArrayBuffer = new ArrayBuffer(0);
    const payloadBuffer = Buffer.from(payload);
    const ecKeyImportParams: EcKeyImportParams = {
      name: "ECDSA",
      namedCurve: "P-384",
    };
    const privateKey = await crypto.subtle.importKey("jwk", privateSigningKey, ecKeyImportParams, true, ["sign"]);
    signature = await window.crypto.subtle.sign(
      {
        name: "ECDSA",
        hash: { name: "SHA-384" },
      },
      privateKey,
      payloadBuffer
    );
    return JSON.stringify(Buffer.from(signature).toJSON());
  }

  async verifySignature(signingPublicKey: JsonWebKey, payload: string, signature: ArrayBuffer): Promise<boolean> {
    let verified = false
    const payloadBuffer = Buffer.from(payload);
    const ecKeyImportParams: EcKeyImportParams = {
      name: "ECDSA",
      namedCurve: "P-384",
    };
    const publicKey = await crypto.subtle.importKey("jwk", signingPublicKey, ecKeyImportParams, true, ["verify"]);
    verified = await crypto.subtle.verify({
      name: "ECDSA",
      hash: { name: "SHA-384" },
    },
      publicKey,
      signature,
      payloadBuffer
    );
    return verified
  }

  async encryptKey(encryptionPublicKey: JsonWebKey, symmetricalKey: JsonWebKey): Promise<ArrayBuffer> {
    const payloadString = JSON.stringify(symmetricalKey);
    const payloadBuffer = new TextEncoder().encode(payloadString);
    const rsaHashedImportParams: RsaHashedImportParams = {
      name: "RSA-OAEP",
      hash: "SHA-256"
    };
    const publicKey = await crypto.subtle.importKey("jwk", encryptionPublicKey, rsaHashedImportParams, true, ["encrypt"]);
    return await crypto.subtle.encrypt(
      {
        name: "RSA-OAEP",
      },
      publicKey,
      payloadBuffer,
    );
  }

  async decryptKey(encryptionPrivateKey: JsonWebKey, payload: ArrayBuffer): Promise<CryptoKey> {
    const payloadBuffer = Buffer.from(payload);
    // Decrypt the paylaod
    const rsaHashedImportParams: RsaHashedImportParams = {
      name: "RSA-OAEP",
      hash: "SHA-256"
    };
    const privateKey = await crypto.subtle.importKey("jwk", encryptionPrivateKey, rsaHashedImportParams, true, ["decrypt"]);
    const decryptedPayload = await crypto.subtle.decrypt(
      {
        name: "RSA-OAEP",
      },
      privateKey,
      payloadBuffer,
    );
    // Convert to CryptoKey
    const decryptKeyAsString = new TextDecoder().decode(decryptedPayload);
    const algorithmIdentifier: AlgorithmIdentifier = {
      name: "AES-GCM"
    };
    return await window.crypto.subtle.importKey('jwk', JSON.parse(decryptKeyAsString), algorithmIdentifier, true, ['encrypt', 'decrypt']);
  }

  async encrypt(encryptionPublicKey: JsonWebKey, payload: string): Promise<string> {
    const payloadBuffer = Buffer.from(payload);
    // Create the symmetrical key
    const algorithmIdentifier: AlgorithmIdentifier = {
      name: "AES-GCM"
    };
    const symmetricalKey = await this.createSymmetricalKey()
    const cryptoKey = await crypto.subtle.importKey("jwk", symmetricalKey, algorithmIdentifier, true, ["encrypt"]);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    // Encrpyt data with symetrical key
    const encryptedData = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      cryptoKey,
      payloadBuffer
    ).catch(() => new ArrayBuffer(0));

    // Encrypt the symmetrical key
    const encryptedKey = await this.encryptKey(encryptionPublicKey, symmetricalKey).catch(() => new ArrayBuffer(0));

    // Put everything together
    const cryptoData: CryptoData = {
      iv: JSON.stringify(Buffer.from(iv).toJSON()),
      encryptedData: JSON.stringify(Buffer.from(encryptedData).toJSON()),
      encryptedKey: JSON.stringify(Buffer.from(encryptedKey).toJSON())
    };
    return JSON.stringify(cryptoData);
  }

  async decrypt(encryptionPrivateKey: JsonWebKey, cryptoData: CryptoData): Promise<string> {
    const payloadBuffer = Buffer.from(JSON.parse(cryptoData.encryptedData));
    // Decrypt the symmetrical Key.
    const decryptKey = await this.decryptKey(encryptionPrivateKey, JSON.parse(cryptoData.encryptedKey))

    // Decrypt the data.
    try {
      const decryptedPayload = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: Buffer.from(JSON.parse(cryptoData.iv))
        },
        decryptKey,
        payloadBuffer,
      );
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(decryptedPayload);
    } catch {
      return "";
    }
  }

  private bytesToBase64(bytes: Uint8Array): string {
    return Buffer.from(bytes).toString('base64');
  }

  private base64ToBytes(value: string): Uint8Array {
    return new Uint8Array(Buffer.from(value, 'base64'));
  }

  private async derivePinKey(pin: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(pin),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async encryptWithPin(
    pin: string,
    payload: string,
    iterations = 250000
  ): Promise<{ envelope: PinEncryptedPayload; key: CryptoKey; salt: Uint8Array; iterations: number }> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await this.derivePinKey(pin, salt, iterations);
    const envelope = await this.encryptWithKey(key, payload, salt, iterations);
    return { envelope, key, salt, iterations };
  }

  async encryptWithKey(
    key: CryptoKey,
    payload: string,
    salt: Uint8Array,
    iterations: number
  ): Promise<PinEncryptedPayload> {
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(payload)
    );

    return {
      format: 'messagedrop-user',
      version: 1,
      payload: this.bytesToBase64(new Uint8Array(encrypted)),
      payloadEncoding: 'base64',
      kdf: {
        name: 'PBKDF2',
        salt: this.bytesToBase64(salt),
        iterations,
        hash: 'SHA-256'
      },
      cipher: {
        name: 'AES-GCM',
        iv: this.bytesToBase64(iv)
      }
    };
  }

  async decryptWithPin(
    pin: string,
    envelope: PinEncryptedPayload
  ): Promise<{ plaintext: string; key: CryptoKey; salt: Uint8Array; iterations: number } | null> {
    if (!envelope?.kdf || !envelope?.cipher || envelope.payloadEncoding !== 'base64') {
      return null;
    }
    const salt = this.base64ToBytes(envelope.kdf.salt);
    const iterations = envelope.kdf.iterations;
    const key = await this.derivePinKey(pin, salt, iterations);
    const iv = this.base64ToBytes(envelope.cipher.iv);
    const payloadBytes = this.base64ToBytes(envelope.payload);

    try {
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        payloadBytes
      );
      const decoder = new TextDecoder('utf-8');
      return {
        plaintext: decoder.decode(decrypted),
        key,
        salt,
        iterations
      };
    } catch {
      return null;
    }
  }

}
