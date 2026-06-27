import { Injectable } from '@angular/core';
import { SecretDropCryptoMetadata, SecretDropDecryptedContent, SecretDropEncryptedPayload } from '../interfaces/secret-drop';
import { Multimedia } from '../interfaces/multimedia';

interface EncryptResult {
  encryptedPayload: SecretDropEncryptedPayload;
  crypto: SecretDropCryptoMetadata;
  authVerifier: string;
}

@Injectable({ providedIn: 'root' })
export class SecretDropCryptoService {
  private readonly iterations = 250_000;

  async encryptSecret(message: string, password: string, multimedia?: Multimedia, style = ''): Promise<EncryptResult> {
    this.ensureWebCrypto();
    const normalizedPassword = this.normalizePassword(password);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const authSalt = crypto.getRandomValues(new Uint8Array(16));
    const key = await this.deriveAesKey(normalizedPassword, this.toArrayBuffer(salt));
    const encoded = new TextEncoder().encode(JSON.stringify({ message, multimedia: multimedia ?? null, style }));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    const authVerifier = await this.deriveAuthVerifier(normalizedPassword, this.toArrayBuffer(authSalt));

    return {
      encryptedPayload: { ciphertext: this.toBase64(new Uint8Array(ciphertext)) },
      crypto: {
        version: 1,
        algorithm: 'AES-GCM',
        kdf: 'PBKDF2',
        hash: 'SHA-256',
        iterations: this.iterations,
        salt: this.toBase64(salt),
        iv: this.toBase64(iv),
        authSalt: this.toBase64(authSalt)
      },
      authVerifier
    };
  }

  async deriveAuthVerifierFromMetadata(password: string, metadata: SecretDropCryptoMetadata): Promise<string> {
    this.ensureWebCrypto();
    return this.deriveAuthVerifier(this.normalizePassword(password), this.fromBase64(metadata.authSalt));
  }

  async decryptSecret(
    encryptedPayload: SecretDropEncryptedPayload,
    metadata: SecretDropCryptoMetadata,
    password: string
  ): Promise<SecretDropDecryptedContent> {
    this.ensureWebCrypto();
    const key = await this.deriveAesKey(this.normalizePassword(password), this.fromBase64(metadata.salt), metadata.iterations);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: this.fromBase64(metadata.iv) },
      key,
      this.fromBase64(encryptedPayload.ciphertext)
    );
    const parsed = JSON.parse(new TextDecoder().decode(decrypted)) as Partial<SecretDropDecryptedContent>;
    return {
      message: String(parsed.message ?? ''),
      multimedia: parsed.multimedia ?? null,
      style: String(parsed.style ?? '')
    };
  }

  private async deriveAesKey(password: string, salt: BufferSource, iterations = this.iterations): Promise<CryptoKey> {
    const baseKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private async deriveAuthVerifier(password: string, salt: BufferSource): Promise<string> {
    const baseKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(`SecretDrop auth:${password}`),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: this.iterations, hash: 'SHA-256' },
      baseKey,
      256
    );
    return this.toBase64(new Uint8Array(bits));
  }

  private normalizePassword(password: string): string {
    const normalized = String(password ?? '');
    if (normalized.length < 6) {
      throw new Error('pin_too_short');
    }
    return normalized;
  }

  private ensureWebCrypto(): void {
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      throw new Error('web_crypto_unavailable');
    }
  }

  private toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  }

  private toBase64(bytes: Uint8Array): string {
    let binary = '';
    bytes.forEach((byte) => binary += String.fromCharCode(byte));
    return btoa(binary);
  }

  private fromBase64(value: string): ArrayBuffer {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return this.toArrayBuffer(bytes);
  }
}
