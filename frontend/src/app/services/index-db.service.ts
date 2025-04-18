import { Injectable } from '@angular/core';
import { CryptedUser } from '../interfaces/crypted-user';
import { Profile } from '../interfaces/profile';

@Injectable({
  providedIn: 'root'
})
export class IndexDbService {
  private dbName = 'messageDropDb';
  private settingStore = 'settings';
  private userStore = 'user';
  private profileStore = 'profile';

  constructor() {
    this.openDB();
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.settingStore)) {
          db.createObjectStore(this.settingStore);
        }
        if (!db.objectStoreNames.contains(this.userStore)) {
          db.createObjectStore(this.userStore);
        }
        if (!db.objectStoreNames.contains(this.profileStore)) {
          db.createObjectStore(this.profileStore);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clearAllData(): Promise<void> {
    const db = await this.openDB();

    return new Promise<void>((resolve, reject) => {
      const storeNames = Array.from(db.objectStoreNames);
      const tx = db.transaction(storeNames, 'readwrite');

      for (const storeName of storeNames) {
        tx.objectStore(storeName).clear();
      }

      tx.oncomplete = () => {
        console.log('Alle Object Stores wurden geleert.');
        resolve();
      };

      tx.onerror = () => {
        console.error('Fehler beim Leeren der Stores:', tx.error);
        reject(tx.error);
      };
    });
  }

  async hasUser(): Promise<boolean> {
    const db = await this.openDB();

    return new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction(this.userStore, 'readonly');
      const store = tx.objectStore(this.userStore);
      const request = store.get('user');

      request.onsuccess = () => resolve(request.result !== undefined);
      request.onerror = () => {
        resolve(false);
      };
    });
  }

  async setUser(cryptedUser: CryptedUser): Promise<void> {
    const db = await this.openDB();

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.userStore, 'readwrite');
      const store = tx.objectStore(this.userStore);
      const request = store.put(cryptedUser, 'user');

      request.onsuccess = () => resolve();
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async getUser(): Promise<CryptedUser | undefined> {
    const db = await this.openDB();

    return new Promise<CryptedUser | undefined>((resolve, reject) => {
      const tx = db.transaction(this.userStore, 'readonly');
      const store = tx.objectStore(this.userStore);
      const request = store.get('user');

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async deleteUser(): Promise<void> {
    const db = await this.openDB();

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.userStore, 'readwrite');
      const store = tx.objectStore(this.userStore);
      const request = store.delete('user');

      request.onsuccess = () => resolve();
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async setProfile(userId: string, profile: Profile): Promise<void> {
    const db = await this.openDB();

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.userStore, 'readwrite');
      const store = tx.objectStore(this.userStore);
      const request = store.put(profile, userId);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async getProfile(userId: string): Promise<Profile | undefined> {
    const db = await this.openDB();

    return new Promise<Profile | undefined>((resolve, reject) => {
      const tx = db.transaction(this.profileStore, 'readonly');
      const store = tx.objectStore(this.profileStore);
      const request = store.get(userId);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async deleteProfile(userId: string): Promise<void> {
    const db = await this.openDB();

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.profileStore, 'readwrite');
      const store = tx.objectStore(this.profileStore);
      const request = store.delete(userId);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

}
