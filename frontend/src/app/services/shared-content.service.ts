import { computed, Injectable, inject, signal } from '@angular/core';
import { Message } from '../interfaces/message';
import { Multimedia } from '../interfaces/multimedia';
import { Note } from '../interfaces/note';
import { SharedContent } from '../interfaces/shared-content';
import { OembedService } from './oembed.service';

@Injectable({ providedIn: 'root' })
export class SharedContentService {
  private dbName = 'ShareTargets';
  private storeName = 'shared';
  private lastKey = 'last';

  private broadcastChannel = new BroadcastChannel('shared-content');
  private sharedContentSignal = signal<SharedContent | null>(null);
  private readonly oembedService = inject(OembedService);

  constructor() {
    this.broadcastChannel.addEventListener('message', (event) => {
      if (event.data?.type === 'shared' && event.data.content) {
        this.sharedContentSignal.set(event.data.content);
      }
    });

    this.openDB().then(async () => {
      const content = await this.getSharedContent('last');
      if (content) {
        this.sharedContentSignal.set(content);
      }
    });
  }

  public getSharedContentSignal() {
    return this.sharedContentSignal.asReadonly();
  }

  public getIsSharedAvailableSignal() {
    return computed(() => this.sharedContentSignal() !== null);
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

  public async deleteSharedContent(id: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.delete(id);
      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
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
