import { Injectable } from '@angular/core';
import { CryptedUser } from '../interfaces/crypted-user';
import { Profile } from '../interfaces/profile';

@Injectable({
  providedIn: 'root'
})
export class IndexedDbService {
  private dbName: string = 'messageDropDb';
  private settingStore: string = 'settings';
  private userStore: string = 'user';
  private profileStore: string = 'profile';
  private contactProfileStore: string = 'contactprofile';
  private placeProfileStore: string = 'placeprofile';
  private noteStore: string = 'note';

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
        if (!db.objectStoreNames.contains(this.contactProfileStore)) {
          db.createObjectStore(this.contactProfileStore);
        }
        if (!db.objectStoreNames.contains(this.placeProfileStore)) {
          db.createObjectStore(this.placeProfileStore);
        }
        if (!db.objectStoreNames.contains(this.noteStore)) {
          db.createObjectStore(this.noteStore);
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
        if (storeName !== this.settingStore) {
          tx.objectStore(storeName).clear();
        }
      }

      tx.oncomplete = () => {
        resolve();
      };

      tx.onerror = () => {
        reject(tx.error);
      };
    });
  }

  async setSetting(key: string, value: any): Promise<void> {
    const db = await this.openDB();

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.settingStore, 'readwrite');
      const store = tx.objectStore(this.settingStore);
      const request = store.put(value, key);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async getSetting(key: string): Promise<any> {
    const db = await this.openDB();

    return new Promise<any>((resolve, reject) => {
      const tx = db.transaction(this.settingStore, 'readonly');
      const store = tx.objectStore(this.settingStore);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async deleteSetting(key: string): Promise<void> {
    const db = await this.openDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.settingStore, 'readwrite');
      const store = tx.objectStore(this.settingStore);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => {
        reject(request.error);
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

  async setProfile(userId: string, profile: Profile): Promise<void> {
    const db = await this.openDB();

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.profileStore, 'readwrite');
      const store = tx.objectStore(this.profileStore);
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

  async getAllProfilesAsMap(): Promise<Map<string, Profile>> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.profileStore, 'readonly');
      const store = tx.objectStore(this.profileStore);

      const keysRequest = store.getAllKeys();
      const valuesRequest = store.getAll();

      keysRequest.onsuccess = () => {
        valuesRequest.onsuccess = () => {
          const keys = keysRequest.result as string[];
          const values = valuesRequest.result as Profile[];

          const map = new Map<string, Profile>();
          for (let i = 0; i < keys.length; i++) {
            map.set(keys[i], values[i]);
          }

          resolve(map);
        };

        valuesRequest.onerror = () => reject(valuesRequest.error);
      };

      keysRequest.onerror = () => reject(keysRequest.error);
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

  async setContactProfile(contactProfileId: string, contactProfile: Profile): Promise<void> {
    const db = await this.openDB();

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.contactProfileStore, 'readwrite');
      const store = tx.objectStore(this.contactProfileStore);
      const request = store.put(contactProfile, contactProfileId);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async getContactProfile(contactProfileId: string): Promise<Profile | undefined> {
    const db = await this.openDB();

    return new Promise<Profile | undefined>((resolve, reject) => {
      const tx = db.transaction(this.contactProfileStore, 'readonly');
      const store = tx.objectStore(this.contactProfileStore);
      const request = store.get(contactProfileId);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async deleteContactProfile(contactProfileId: string): Promise<void> {
    const db = await this.openDB();

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.contactProfileStore, 'readwrite');
      const store = tx.objectStore(this.contactProfileStore);
      const request = store.delete(contactProfileId);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async setPlaceProfile(placeProfileId: string, placeProfile: Profile): Promise<void> {
    const db = await this.openDB();

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.placeProfileStore, 'readwrite');
      const store = tx.objectStore(this.placeProfileStore);
      const request = store.put(placeProfile, placeProfileId);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async getPlaceProfile(placeProfileId: string): Promise<Profile | undefined> {
    const db = await this.openDB();

    return new Promise<Profile | undefined>((resolve, reject) => {
      const tx = db.transaction(this.placeProfileStore, 'readonly');
      const store = tx.objectStore(this.placeProfileStore);
      const request = store.get(placeProfileId);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async deletePlaceProfile(placeProfileId: string): Promise<void> {
    const db = await this.openDB();

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.placeProfileStore, 'readwrite');
      const store = tx.objectStore(this.placeProfileStore);
      const request = store.delete(placeProfileId);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

}
