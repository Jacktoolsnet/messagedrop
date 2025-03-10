import { Injectable } from '@angular/core';
import { Buffer } from 'buffer';
import { CryptoData } from '../interfaces/crypto-data';
import { Keypair } from '../interfaces/keypair';

@Injectable({
  providedIn: 'root'
})
export class CryptoService {

  // https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API

  constructor() { }

  async createHash(payload: any) {
    const payloadUint8 = new TextEncoder().encode(payload);
    const hashBuffer = await crypto.subtle.digest('SHA-256', payloadUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(''); // Array zu Hex-String
    return hash;
  }

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

  async createSignature(privateSigningKey: JsonWebKey, payload: any): Promise<string> {
    let signature: ArrayBuffer = new ArrayBuffer(0);
    let payloadBuffer = Buffer.from(payload);
    let ecKeyImportParams: EcKeyImportParams = {
      name: "ECDSA",
      namedCurve: "P-384",
    };
    let privateKey = await crypto.subtle.importKey("jwk", privateSigningKey, ecKeyImportParams, true, ["sign"]);
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

  async verifySignature(signingPublicKey: JsonWebKey, payload: any, signature: ArrayBuffer): Promise<Boolean> {
    let verified: Boolean = false
    let payloadBuffer = Buffer.from(payload);
    let ecKeyImportParams: EcKeyImportParams = {
      name: "ECDSA",
      namedCurve: "P-384",
    };
    let publicKey = await crypto.subtle.importKey("jwk", signingPublicKey, ecKeyImportParams, true, ["verify"]);
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
    let rsaHashedImportParams: RsaHashedImportParams = {
      name: "RSA-OAEP",
      hash: "SHA-256"
    };
    let publicKey = await crypto.subtle.importKey("jwk", encryptionPublicKey, rsaHashedImportParams, true, ["encrypt"]);
    return await crypto.subtle.encrypt(
      {
        name: "RSA-OAEP",
      },
      publicKey,
      payloadBuffer,
    );
  }

  async decryptKey(encryptionPrivateKey: JsonWebKey, payload: ArrayBuffer): Promise<CryptoKey> {
    let payloadBuffer = Buffer.from(payload);
    // Decrypt the paylaod
    let rsaHashedImportParams: RsaHashedImportParams = {
      name: "RSA-OAEP",
      hash: "SHA-256"
    };
    let privateKey = await crypto.subtle.importKey("jwk", encryptionPrivateKey, rsaHashedImportParams, true, ["decrypt"]);
    const decryptedPayload = await crypto.subtle.decrypt(
      {
        name: "RSA-OAEP",
      },
      privateKey,
      payloadBuffer,
    );
    // Convert to CryptoKey
    const decryptKeyAsString = new TextDecoder().decode(decryptedPayload);
    let algorithmIdentifier: AlgorithmIdentifier = {
      name: "AES-GCM"
    };
    return await window.crypto.subtle.importKey('jwk', JSON.parse(decryptKeyAsString), algorithmIdentifier, true, ['encrypt', 'decrypt']);
  }

  async encrypt(encryptionPublicKey: JsonWebKey, payload: any): Promise<string> {
    let payloadBuffer = Buffer.from(payload);
    // Create the symmetrical key
    let algorithmIdentifier: AlgorithmIdentifier = {
      name: "AES-GCM"
    };
    const symmetricalKey = await this.createSymmetricalKey()
    let cryptoKey = await crypto.subtle.importKey("jwk", symmetricalKey, algorithmIdentifier, true, ["encrypt"]);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    // Encrpyt data with symetrical key
    const encryptedData = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      cryptoKey,
      payloadBuffer
    ).catch((err) => {
      return new ArrayBuffer(0);
    });

    // Encrypt the symmetrical key
    const encryptedKey = await this.encryptKey(encryptionPublicKey, symmetricalKey).catch((err) => {
      return new ArrayBuffer(0);
    });

    // Put everything together
    let cryptoData: CryptoData = {
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
      let decoder = new TextDecoder('utf-8');
      return decoder.decode(decryptedPayload);
    } catch (err) {
      return "";
    }

  }

}
