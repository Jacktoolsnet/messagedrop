import { Injectable } from '@angular/core';
import { Buffer } from 'buffer';
import { Keypair } from '../interfaces/keypair';

@Injectable({
  providedIn: 'root'
})
export class CryptoService {

  // https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API

  constructor() { }

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

  async encryptKey(encryptionPublicKey: JsonWebKey, symmetricalKey: JsonWebKey): Promise<string> {
    const payloadString = JSON.stringify(symmetricalKey);
    const payloadBuffer = new TextEncoder().encode(payloadString);
    let rsaHashedImportParams: RsaHashedImportParams = {
      name: "RSA-OAEP",
      hash: "SHA-256"
    };
    let publicKey = await crypto.subtle.importKey("jwk", encryptionPublicKey, rsaHashedImportParams, true, ["encrypt"]);
    const encryptedPayload = await crypto.subtle.encrypt(
      {
        name: "RSA-OAEP",
      },
      publicKey,
      payloadBuffer,
    );
    return JSON.stringify(Buffer.from(encryptedPayload).toJSON());
  }

  async decryptKey(encryptionPrivateKey: JsonWebKey, payload: ArrayBuffer): Promise<string> {
    let payloadBuffer = Buffer.from(payload);
    let decryptedPayload: ArrayBuffer = new ArrayBuffer(0);
    let rsaHashedImportParams: RsaHashedImportParams = {
      name: "RSA-OAEP",
      hash: "SHA-256"
    };
    let privateKey = await crypto.subtle.importKey("jwk", encryptionPrivateKey, rsaHashedImportParams, true, ["decrypt"]);
    try {
      decryptedPayload = await crypto.subtle.decrypt(
        {
          name: "RSA-OAEP",
        },
        privateKey,
        payloadBuffer,
      );
      let decoder = new TextDecoder('utf-8');
      return decoder.decode(decryptedPayload);
    } catch (err) {
      return "";
    }

  }

  async encrypt(encryptionPublicKey: JsonWebKey, symmetricalKey: JsonWebKey, payload: any): Promise<string> {
    let encryptedPayload: ArrayBuffer = new ArrayBuffer(0);
    let payloadBuffer = Buffer.from(payload);
    let algorithmIdentifier: AlgorithmIdentifier = {
      name: "AES-GCM"
    };
    let aesGcmKey = await crypto.subtle.importKey("jwk", encryptionPublicKey, algorithmIdentifier, true, ["encrypt"]);

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedData = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      aesGcmKey,
      payload
    );
    console.log({ iv: iv, encryptedData: encryptedData });
    return JSON.stringify({ iv: iv, encryptedData: encryptedData });
  }

  async decrypt(encryptionPrivateKey: JsonWebKey, payload: ArrayBuffer): Promise<string> {
    let payloadBuffer = Buffer.from(payload);
    let decryptedPayload: ArrayBuffer = new ArrayBuffer(0);
    let rsaHashedImportParams: RsaHashedImportParams = {
      name: "RSA-OAEP",
      hash: "SHA-256"
    };
    let privateKey = await crypto.subtle.importKey("jwk", encryptionPrivateKey, rsaHashedImportParams, true, ["decrypt"]);
    try {
      decryptedPayload = await crypto.subtle.decrypt(
        {
          name: "RSA-OAEP",
        },
        privateKey,
        payloadBuffer,
      );
      let decoder = new TextDecoder('utf-8');
      return decoder.decode(decryptedPayload);
    } catch (err) {
      return "";
    }

  }

}
