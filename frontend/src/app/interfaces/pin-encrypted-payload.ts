export interface PinEncryptedPayload {
  format: 'messagedrop-user';
  version: 1;
  payload: string;
  payloadEncoding: 'base64';
  kdf: {
    name: 'PBKDF2';
    salt: string;
    iterations: number;
    hash: 'SHA-256';
  };
  cipher: {
    name: 'AES-GCM';
    iv: string;
  };
}
