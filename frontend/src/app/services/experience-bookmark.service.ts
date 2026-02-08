import { Injectable, inject, signal } from '@angular/core';
import { ExperienceBookmark } from '../interfaces/experience-bookmark';
import { ExperienceResult } from '../interfaces/viator';
import { TileSetting } from '../interfaces/tile-settings';
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
    const existing = await this.indexedDb.getExperienceBookmark(productCode);
    const currentBookmarks = this.bookmarksSignal();
    const hasManualSort = currentBookmarks.some((bookmark) => typeof bookmark.sortOrder === 'number');
    const bookmark: ExperienceBookmark = {
      productCode,
      snapshot,
      lastUpdatedAt,
      sortOrder: existing?.sortOrder ?? (hasManualSort ? this.getNextSortOrder(currentBookmarks) : undefined)
    };
    await this.indexedDb.setExperienceBookmark(bookmark);
    await this.loadBookmarks();
  }

  async updateSnapshot(productCode: string, snapshot: ExperienceResult, lastUpdatedAt = Date.now()): Promise<void> {
    if (!productCode) return;
    const existing = await this.indexedDb.getExperienceBookmark(productCode);
    const next: ExperienceBookmark = {
      productCode,
      snapshot,
      lastUpdatedAt: lastUpdatedAt ?? existing?.lastUpdatedAt ?? Date.now(),
      sortOrder: existing?.sortOrder
    };
    await this.indexedDb.setExperienceBookmark(next);
    await this.loadBookmarks();
  }

  async removeBookmark(productCode: string): Promise<void> {
    await this.indexedDb.deleteExperienceBookmark(productCode);
    await this.loadBookmarks();
  }

  async updateBookmarkOrder(orderedProductCodes: string[]): Promise<void> {
    if (!orderedProductCodes.length) {
      return;
    }

    const current = this.bookmarksSignal();
    if (!current.length) {
      return;
    }

    const orderMap = new Map(orderedProductCodes.map((productCode, index) => [productCode, index]));
    const fallbackStart = orderedProductCodes.length;
    let fallbackIndex = 0;

    const updated = current.map((bookmark) => {
      const order = orderMap.get(bookmark.productCode);
      if (order === undefined) {
        const value = fallbackStart + fallbackIndex;
        fallbackIndex += 1;
        return { ...bookmark, sortOrder: value };
      }
      return { ...bookmark, sortOrder: order };
    });

    await Promise.all(updated.map((bookmark) => this.indexedDb.setExperienceBookmark(bookmark)));
    this.bookmarksSignal.set(this.sortBookmarks(updated));
  }

  async hasBookmark(productCode: string): Promise<boolean> {
    if (!productCode) return false;
    const existing = await this.indexedDb.getExperienceBookmark(productCode);
    return Boolean(existing);
  }

  async getTileSettings(productCode: string): Promise<TileSetting[] | undefined> {
    if (!productCode) return undefined;
    return this.indexedDb.getTileSettings(productCode);
  }

  async saveTileSettings(productCode: string, tileSettings: TileSetting[]): Promise<void> {
    if (!productCode) return;
    await this.indexedDb.setTileSettings(productCode, tileSettings);
  }

  async deleteTileSettings(productCode: string): Promise<void> {
    if (!productCode) return;
    await this.indexedDb.deleteTileSettings(productCode);
  }

  ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return Promise.resolve();
    }
    return this.loadBookmarks();
  }

  private sortBookmarks(bookmarks: ExperienceBookmark[]): ExperienceBookmark[] {
    return [...bookmarks].sort((a, b) => {
      const orderA = typeof a.sortOrder === 'number' ? a.sortOrder : Number.POSITIVE_INFINITY;
      const orderB = typeof b.sortOrder === 'number' ? b.sortOrder : Number.POSITIVE_INFINITY;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      const updatedCompare = b.lastUpdatedAt - a.lastUpdatedAt;
      if (updatedCompare !== 0) {
        return updatedCompare;
      }
      return a.productCode.localeCompare(b.productCode);
    });
  }

  private getNextSortOrder(bookmarks: ExperienceBookmark[]): number {
    const orders = bookmarks
      .map((bookmark) => bookmark.sortOrder)
      .filter((order): order is number => typeof order === 'number');
    if (!orders.length) {
      return bookmarks.length;
    }
    return Math.max(...orders) + 1;
  }
}
