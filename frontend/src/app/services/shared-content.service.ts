import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SharedContent } from '../interfaces/shared-content';

@Injectable({
  providedIn: 'root'
})
export class SharedContentService {
  private dbName = 'ShareTargets';
  private storeName = 'shared';
  private sharedContentSubject = new BehaviorSubject<SharedContent[] | null>(null);

  constructor() {
    this.openDB();
    this.setupServiceWorkerListener();
  }

  public getSharedContentObservable(): Observable<SharedContent[] | null> {
    return this.sharedContentSubject.asObservable();
  }

  private setupServiceWorkerListener() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'shared' && event.data.content) {
          const incoming = event.data.content as SharedContent;
          this.sharedContentSubject.next([incoming]);
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

  public async getAllSharedContent(): Promise<SharedContent[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  public async deleteSharedContent(id: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async getAndClear(): Promise<SharedContent[]> {
    const all = await this.getAllSharedContent();
    for (const entry of all) {
      await this.deleteSharedContent(entry.id);
    }
    return all;
  }

  public async checkNewSharedContent(): Promise<void> {
    const newItems = await this.getAndClear();
    if (newItems.length > 0) {
      this.sharedContentSubject.next(newItems);
    }
  }
}
