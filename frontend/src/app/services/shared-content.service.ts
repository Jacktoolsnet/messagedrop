import { Injectable, inject, signal } from '@angular/core';
import { Message } from '../interfaces/message';
import { Multimedia } from '../interfaces/multimedia';
import { Note } from '../interfaces/note';
import { ShortMessage } from '../interfaces/short-message';
import { SharedContent } from '../interfaces/shared-content';
import { MultimediaType } from '../interfaces/multimedia-type';
import { OembedService } from './oembed.service';

@Injectable({ providedIn: 'root' })
export class SharedContentService {
  private readonly dbName = 'ShareTargets';
  private readonly storeName = 'shared';
  private readonly lastKey = 'last';

  private readonly broadcastChannel = typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('shared-content')
    : undefined;
  private readonly sharedContentSignal = signal<SharedContent | null>(null);
  private readonly oembedService = inject(OembedService);

  constructor() {
    this.broadcastChannel?.addEventListener('message', (event) => {
      if (event.data?.type === 'shared' && event.data.content) {
        this.sharedContentSignal.set(event.data.content);
      }
    });

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'shared' && event.data.content) {
          this.sharedContentSignal.set(event.data.content);
        }
      });
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          void this.refreshSharedContentFromStorage();
        }
      });
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        void this.refreshSharedContentFromStorage();
      });
    }

    void this.refreshSharedContentFromStorage();
  }

  public getSharedContentSignal() {
    return this.sharedContentSignal.asReadonly();
  }

  public async refreshSharedContentFromStorage(): Promise<void> {
    try {
      const content = await this.getSharedContent(this.lastKey);
      if (content) {
        this.sharedContentSignal.set(content);
      }
    } catch {
      // Best effort only
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

  private async resolveSharedMultimedia(): Promise<Multimedia | undefined> {
    const lastMultimediaContent = await this.getSharedContent('lastMultimedia');
    const fallbackContent = await this.getSharedContent(this.lastKey);
    const candidateUrl = lastMultimediaContent?.url ?? fallbackContent?.url;
    if (!candidateUrl) {
      return undefined;
    }

    const resolved = await this.oembedService.getObjectFromUrl(candidateUrl);
    if (this.oembedService.isMultimedia(resolved)) {
      return resolved;
    }
    return undefined;
  }

  private async resolveSharedText(): Promise<string | undefined> {
    const content = await this.getSharedContent(this.lastKey);
    if (!content) {
      return undefined;
    }
    const text = typeof content.text === 'string' ? content.text.trim() : '';
    const title = typeof content.title === 'string' ? content.title.trim() : '';
    const url = typeof content.url === 'string' ? content.url.trim() : '';
    const segments = [text, title, url].filter(Boolean);
    if (!segments.length) {
      return undefined;
    }
    return segments.join('\n').trim();
  }

  private normalizeComparableValue(value?: string | null): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private isSameMultimedia(
    candidate: Pick<Multimedia, 'type' | 'url' | 'sourceUrl' | 'contentId'>,
    shared: Multimedia
  ): boolean {
    if (candidate.type !== shared.type || candidate.type === MultimediaType.UNDEFINED) {
      return false;
    }

    const candidateContentId = this.normalizeComparableValue(candidate.contentId);
    const sharedContentId = this.normalizeComparableValue(shared.contentId);
    if (candidateContentId && sharedContentId && candidateContentId === sharedContentId) {
      return true;
    }

    const candidateUrls = new Set(
      [candidate.url, candidate.sourceUrl]
        .map((value) => this.normalizeComparableValue(value))
        .filter(Boolean)
    );
    const sharedUrls = [shared.url, shared.sourceUrl]
      .map((value) => this.normalizeComparableValue(value))
      .filter(Boolean);

    return sharedUrls.some((value) => candidateUrls.has(value));
  }

  public async discardSharedMultimediaIfUsed(
    multimedia?: Pick<Multimedia, 'type' | 'url' | 'sourceUrl' | 'contentId'> | null
  ): Promise<boolean> {
    if (!multimedia || multimedia.type === MultimediaType.UNDEFINED) {
      return false;
    }

    let sharedMultimedia: Multimedia | undefined;
    try {
      sharedMultimedia = await this.resolveSharedMultimedia();
    } catch {
      return false;
    }

    if (!sharedMultimedia || !this.isSameMultimedia(multimedia, sharedMultimedia)) {
      return false;
    }

    await Promise.all([
      this.deleteSharedContent(this.lastKey),
      this.deleteSharedContent('lastMultimedia')
    ]);

    return true;
  }

  public async addSharedContentToMessage(message: Message): Promise<void> {
    const multimedia = await this.resolveSharedMultimedia();
    if (multimedia) {
      message.multimedia = multimedia;
      return;
    }

    if (message.multimedia.type === MultimediaType.UNDEFINED && !message.message?.trim()) {
      const fallbackText = await this.resolveSharedText();
      if (fallbackText) {
        message.message = fallbackText;
      }
    }
  }

  public async addSharedContentToNote(note: Note): Promise<void> {
    const multimedia = await this.resolveSharedMultimedia();
    if (multimedia) {
      note.multimedia = multimedia;
      return;
    }

    if (note.multimedia.type === MultimediaType.UNDEFINED && !note.note?.trim()) {
      const fallbackText = await this.resolveSharedText();
      if (fallbackText) {
        note.note = fallbackText;
      }
    }
  }

  public async addSharedContentToShortMessage(shortMessage: ShortMessage): Promise<void> {
    const multimedia = await this.resolveSharedMultimedia();
    if (multimedia) {
      shortMessage.multimedia = multimedia;
      return;
    }

    if (shortMessage.multimedia.type === MultimediaType.UNDEFINED && !shortMessage.message?.trim()) {
      const fallbackText = await this.resolveSharedText();
      if (fallbackText) {
        shortMessage.message = fallbackText;
      }
    }
  }
}
