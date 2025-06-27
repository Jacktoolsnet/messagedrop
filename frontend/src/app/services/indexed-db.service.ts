import { Injectable } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';
import { BoundingBox } from '../interfaces/bounding-box';
import { CryptedUser } from '../interfaces/crypted-user';
import { Note } from '../interfaces/note';
import { Place } from '../interfaces/place';
import { Profile } from '../interfaces/profile';

/**
 * Service for managing data in IndexedDB for the MessageDrop application.
 * Provides CRUD operations for settings, users, profiles, contact profiles, places, and notes.
 */
@Injectable({
  providedIn: 'root'
})
export class IndexedDbService {
  private dbName: string = 'MessageDrop';
  private settingStore: string = 'setting';
  private userStore: string = 'user';
  private profileStore: string = 'profile';
  private contactProfileStore: string = 'contactprofile';
  private placeStore: string = 'place';
  private noteStore: string = 'note';

  /**
   * Initializes the IndexedDB database on service construction.
   */
  constructor() {
    this.openDB();
  }

  /**
   * Opens the IndexedDB database and creates object stores if they do not exist.
   * @returns Promise that resolves with the opened IDBDatabase instance.
   */
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
        if (!db.objectStoreNames.contains(this.placeStore)) {
          db.createObjectStore(this.placeStore);
        }
        if (!db.objectStoreNames.contains(this.noteStore)) {
          db.createObjectStore(this.noteStore);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clears all data from all object stores except for the settings store.
   * @returns Promise that resolves when all data is cleared.
   */
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

  /**
   * Stores a setting value by key.
   * @param key The setting key.
   * @param value The value to store.
   * @returns Promise that resolves when the value is stored.
   */
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

  /**
   * Retrieves a setting value by key.
   * @param key The setting key.
   * @returns Promise that resolves with the value or undefined if not found.
   */
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

  /**
   * Deletes a setting by key.
   * @param key The setting key.
   * @returns Promise that resolves when the setting is deleted.
   */
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

  /**
   * Stores the encrypted user object.
   * @param cryptedUser The encrypted user object to store.
   * @returns Promise that resolves when the user is stored.
   */
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

  /**
   * Retrieves the encrypted user object.
   * @returns Promise that resolves with the encrypted user or undefined if not found.
   */
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

  /**
   * Deletes the encrypted user object.
   * @returns Promise that resolves when the user is deleted.
   */
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

  /**
   * Checks if a user exists in the database.
   * @returns Promise that resolves with true if a user exists, otherwise false.
   */
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

  /**
   * Stores a profile for a user.
   * @param userId The user ID.
   * @param profile The profile to store.
   * @returns Promise that resolves when the profile is stored.
   */
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

  /**
   * Retrieves a profile by user ID.
   * @param userId The user ID.
   * @returns Promise that resolves with the profile or undefined if not found.
   */
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

  /**
   * Retrieves all profiles as a Map of userId to Profile.
   * @returns Promise that resolves with a Map of userId to Profile.
   */
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

  /**
   * Deletes a profile by user ID.
   * @param userId The user ID.
   * @returns Promise that resolves when the profile is deleted.
   */
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

  /**
   * Stores a contact profile.
   * @param contactProfileId The contact profile ID.
   * @param contactProfile The profile to store.
   * @returns Promise that resolves when the contact profile is stored.
   */
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

  /**
   * Retrieves a contact profile by ID.
   * @param contactProfileId The contact profile ID.
   * @returns Promise that resolves with the profile or undefined if not found.
   */
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

  /**
   * Deletes a contact profile by ID.
   * @param contactProfileId The contact profile ID.
   * @returns Promise that resolves when the contact profile is deleted.
   */
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

  /**
   * Stores a place profile.
   * @param placeId The place ID.
   * @param place The place object to store.
   * @returns Promise that resolves when the place is stored.
   */
  async setPlaceProfile(placeId: string, place: Place): Promise<void> {
    const db = await this.openDB();

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.placeStore, 'readwrite');
      const store = tx.objectStore(this.placeStore);
      const request = store.put(place, placeId);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Retrieves a place by ID.
   * @param placeId The place ID.
   * @returns Promise that resolves with the place or undefined if not found.
   */
  async getPlace(placeId: string): Promise<Place | undefined> {
    const db = await this.openDB();

    return new Promise<Place | undefined>((resolve, reject) => {
      const tx = db.transaction(this.placeStore, 'readonly');
      const store = tx.objectStore(this.placeStore);
      const request = store.get(placeId);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Deletes a place by ID.
   * @param placeId The place ID.
   * @returns Promise that resolves when the place is deleted.
   */
  async deletePlace(placeId: string): Promise<void> {
    const db = await this.openDB();

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.placeStore, 'readwrite');
      const store = tx.objectStore(this.placeStore);
      const request = store.delete(placeId);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Saves a note (creates a new note with a UUID or updates an existing one).
   * @param note The note data (without id and timestamp).
   * @param id Optional note ID to update.
   * @returns Promise that resolves with the note ID.
   */
  async saveNote(note: Note): Promise<string> {
    const db = await this.openDB();
    const key = uuidv4();
    const noteWithMeta: Note = {
      ...note,
      id: key,
      timestamp: Date.now()
    };
    return new Promise<string>((resolve, reject) => {
      const tx = db.transaction(this.noteStore, 'readwrite');
      const store = tx.objectStore(this.noteStore);
      const request = store.put(noteWithMeta, key);
      request.onsuccess = () => resolve(key);
      request.onerror = () => reject(request.error);
    });
  }

  /**
 * Updates an existing note by ID.
 * The note's timestamp will be refreshed to the current time.
 * 
 * @param note The full Note object with a valid existing ID.
 * @returns Promise that resolves when the note has been updated.
 */
  async updateNote(note: Note): Promise<void> {
    const db = await this.openDB();
    const updatedNote: Note = {
      ...note,
      timestamp: Date.now() // Refresh timestamp
    };

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.noteStore, 'readwrite');
      const store = tx.objectStore(this.noteStore);
      const request = store.put(updatedNote, note.id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Retrieves a note by ID.
   * @param id The note ID.
   * @returns Promise that resolves with the note or undefined if not found.
   */
  async getNote(id: string): Promise<Note | undefined> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.noteStore, 'readonly');
      const store = tx.objectStore(this.noteStore);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Deletes a note by ID.
   * @param id The note ID.
   * @returns Promise that resolves when the note is deleted.
   */
  async deleteNote(id: string): Promise<void> {
    const db = await this.openDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.noteStore, 'readwrite');
      const store = tx.objectStore(this.noteStore);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Retrieves all notes as an array, sorted by newest first.
   * @returns Promise that resolves with an array of notes.
   */
  async getAllNotes(): Promise<Note[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.noteStore, 'readonly');
      const store = tx.objectStore(this.noteStore);
      const request = store.getAll();
      request.onsuccess = () => {
        const notes = request.result as Note[];
        resolve(notes.sort((a, b) => b.timestamp - a.timestamp)); // Newest first
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Retrieves all notes within a given bounding box, sorted by newest first.
   * @param boundingBox The bounding box to filter notes.
   * @returns Promise that resolves with an array of notes within the bounding box.
   */
  async getNotesInBoundingBox(boundingBox: BoundingBox): Promise<Note[]> {
    const allNotes = await this.getAllNotes();
    return allNotes
      .filter(note =>
        note.latitude >= boundingBox.latMin &&
        note.latitude <= boundingBox.latMax &&
        note.longitude >= boundingBox.lonMin &&
        note.longitude <= boundingBox.lonMax
      )
      .sort((a, b) => b.timestamp - a.timestamp); // Newest first
  }

}
