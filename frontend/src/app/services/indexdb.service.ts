import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})

export class IndexdbService {
  dbName: string;
  storeName: string;
  key: null;
  db: IDBOpenDBRequest | null;

  constructor(dbName = 'SecureDB', storeName = 'SecureStore') {
    this.dbName = dbName;
    this.storeName = storeName;
    this.key = null;
    this.db = null;
  }

  /**
   * Initialisiert die IndexedDB-Datenbank
   */
  async init() {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest)?.result;
        if (db) {
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: 'id' });
          }
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBRequest)?.result;
        resolve();
      };

      request.onerror = (event) => {
        reject((event.target as IDBRequest)?.error || new Error('Unknown error occurred'));
      };
    });
  }

  /**
  * Erstellt einen sicheren Schlüssel im Hardware-Sicherheitsschlüssel
  */
  async generateHardwareKey() {
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: new Uint8Array(32), // Zufällige Challenge
        rp: { name: "Secure App" },
        user: {
          id: new Uint8Array(16),
          displayName: '',
          name: ''
        },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }], // ES256 Algorithmus
        authenticatorSelection: { authenticatorAttachment: "platform" },
      },
    });
    return credential;
  }

  async storeKeyInCredentials() {
    if (!this.key) throw new Error("Kein Schlüssel verfügbar");

    const keyData = await crypto.subtle.exportKey("raw", this.key);
    const credential = new Credential();

    await navigator.credentials.store(credential);
  }

  /**
   * Lädt den Schlüssel aus dem Credential-Store
   */
  async loadKeyFromCredentials() {
    const credential = await navigator.credentials.get({ password: true });
    if (!credential?.password) {
      throw new Error("Kein Passwort im Credential Store gefunden");
    }

    const keyData = Uint8Array.from(atob(credential.password), (c) => c.charCodeAt(0));
    this.key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  }
}
