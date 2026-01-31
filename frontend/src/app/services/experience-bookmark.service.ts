import { Injectable, inject, signal } from '@angular/core';
import { ExperienceBookmark } from '../interfaces/experience-bookmark';
import { ExperienceResult } from '../interfaces/viator';
import { IndexedDbService } from './indexed-db.service';

@Injectable({
  providedIn: 'root'
})
export class ExperienceBookmarkService {
  private readonly indexedDb = inject(IndexedDbService);
  readonly bookmarksSignal = signal<ExperienceBookmark[]>([]);

  private loaded = false;

  async loadBookmarks(): Promise<void> {
    const bookmarks = await this.indexedDb.getAllExperienceBookmarks();
    this.bookmarksSignal.set(this.sortBookmarks(bookmarks));
    this.loaded = true;
  }

  async saveBookmark(productCode: string, snapshot: ExperienceResult, lastUpdatedAt = Date.now()): Promise<void> {
    if (!productCode) return;
    const bookmark: ExperienceBookmark = { productCode, snapshot, lastUpdatedAt };
    await this.indexedDb.setExperienceBookmark(bookmark);
    await this.loadBookmarks();
  }

  async updateSnapshot(productCode: string, snapshot: ExperienceResult, lastUpdatedAt = Date.now()): Promise<void> {
    if (!productCode) return;
    const existing = await this.indexedDb.getExperienceBookmark(productCode);
    const next: ExperienceBookmark = {
      productCode,
      snapshot,
      lastUpdatedAt: lastUpdatedAt ?? existing?.lastUpdatedAt ?? Date.now()
    };
    await this.indexedDb.setExperienceBookmark(next);
    await this.loadBookmarks();
  }

  async removeBookmark(productCode: string): Promise<void> {
    await this.indexedDb.deleteExperienceBookmark(productCode);
    await this.loadBookmarks();
  }

  async hasBookmark(productCode: string): Promise<boolean> {
    if (!productCode) return false;
    const existing = await this.indexedDb.getExperienceBookmark(productCode);
    return Boolean(existing);
  }

  ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return Promise.resolve();
    }
    return this.loadBookmarks();
  }

  private sortBookmarks(bookmarks: ExperienceBookmark[]): ExperienceBookmark[] {
    return [...bookmarks].sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt);
  }
}
