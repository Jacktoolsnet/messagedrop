import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Message } from '../interfaces/message';
import { Multimedia } from '../interfaces/multimedia';
import { Note } from '../interfaces/note';
import { SharedContent } from '../interfaces/shared-content';
import { MapService } from './map.service';
import { OembedService } from './oembed.service';

@Injectable({ providedIn: 'root' })
export class SharedContentService {
  private dbName = 'ShareTargets';
  private storeName = 'shared';
  private lastKey = 'last';

  private sharedAvailableSubject = new BehaviorSubject<boolean>(false);

  constructor(
    private oembedService: OembedService, // Assuming OembedService is defined elsewhere
    private mapService: MapService // Assuming MapService is defined elsewhere
  ) {
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
          await this.saveSharedContent('last', event.data.content);
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

  public async getSharedContent(id: string): Promise<SharedContent | undefined> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result as SharedContent);
      request.onerror = () => reject(request.error);
    });
  }

  private async saveSharedContent(id: string, content: SharedContent): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.put({ ...content, id });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async deleteSharedContent(id: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.delete(id);
      request.onsuccess = () => {
        if (id === this.lastKey) {
          this.sharedAvailableSubject.next(false);
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async checkIfSharedExists(): Promise<void> {
    const last = await this.getSharedContent('last');
    this.sharedAvailableSubject.next(!!last);
  }

  public async addSharedContentToMessage(message: Message): Promise<void> {
    const lastMultimediaContent = await this.getSharedContent('lastMultimedia');
    let lastMultimedia: Multimedia | undefined = undefined;
    if (lastMultimediaContent) {
      lastMultimedia = await this.oembedService.getObjectFromUrl(lastMultimediaContent!.url) as Multimedia;
      if (undefined != lastMultimedia) {
        message.multimedia = lastMultimedia;
      }
    }
  }

  public async addSharedContentToNote(note: Note): Promise<void> {
    const lastMultimediaContent = await this.getSharedContent('lastMultimedia');
    let lastMultimedia: Multimedia | undefined = undefined;
    if (lastMultimediaContent) {
      lastMultimedia = await this.oembedService.getObjectFromUrl(lastMultimediaContent!.url) as Multimedia;
      if (undefined != lastMultimedia) {
        note.multimedia = lastMultimedia;
      }
    }
  }
}