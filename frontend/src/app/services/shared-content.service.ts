import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SharedContent } from '../interfaces/shared-content';

@Injectable({ providedIn: 'root' })
export class SharedContentService {
  private dbName = 'ShareTargets';
  private storeName = 'shared';
  private lastKey = 'last';

  private sharedAvailableSubject = new BehaviorSubject<boolean>(false);

  constructor() {
    this.openDB();
    this.setupServiceWorkerListener();
    this.checkIfSharedExists();
  }

  public getSharedAvailableObservable(): Observable<boolean> {
    return this.sharedAvailableSubject.asObservable();
  }

  private setupServiceWorkerListener() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', async (event) => {
        if (event.data?.type === 'shared' && event.data.content) {
          await this.saveLast(event.data.content);
          this.sharedAvailableSubject.next(true);
        }
      });
    }
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  public async getLast(): Promise<SharedContent | undefined> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get(this.lastKey);
      request.onsuccess = () => resolve(request.result as SharedContent);
      request.onerror = () => reject(request.error);
    });
  }

  public async deleteLast(): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.delete(this.lastKey);
      request.onsuccess = () => {
        this.sharedAvailableSubject.next(false);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async saveLast(content: SharedContent): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.put({ ...content, id: this.lastKey });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async checkIfSharedExists(): Promise<void> {
    const last = await this.getLast();
    this.sharedAvailableSubject.next(!!last);
  }
}