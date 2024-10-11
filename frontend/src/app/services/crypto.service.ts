import { Injectable } from '@angular/core';
import { Keypair } from '../interfaces/keypair';
import { User } from '../interfaces/user';
import { Buffer } from 'buffer';

@Injectable({
  providedIn: 'root'
})
export class CryptoService {

  constructor() { }

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
    const keypair: Keypair = {publicKey, privateKey};
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
    const keypair: Keypair = {publicKey, privateKey};
    return keypair;
  }

  async createSignature(signingUser: User): Promise<ArrayBuffer> {
    let signature: ArrayBuffer = new ArrayBuffer(0);
    if (signingUser.signingKeyPair!.privateKey) {
      let payload = Buffer.from(signingUser.id);
      let ecKeyImportParams: EcKeyImportParams = {
        name: "ECDSA",
        namedCurve: "P-384",
      };
      let privateKey = await crypto.subtle.importKey("jwk", signingUser.signingKeyPair!.privateKey, ecKeyImportParams, true, ["sign"]);
      signature = await window.crypto.subtle.sign(
        {
          name: "ECDSA",
          hash: { name: "SHA-384" },
        },
        privateKey,
        payload
      );  
    }
    return signature;
  }

  async verifySignature(signingUserId: string, signingPublicKey: JsonWebKey, signature: ArrayBuffer): Promise<Boolean> {
    let verified: Boolean = false
    let payload = Buffer.from(signingUserId);
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
      payload
    );
    return verified
  }
  
}