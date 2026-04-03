import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Multimedia } from '../interfaces/multimedia';
import { MultimediaType } from '../interfaces/multimedia-type';
import { StickerCategory } from '../interfaces/sticker-category.interface';
import { StickerPack } from '../interfaces/sticker-pack.interface';
import { Sticker } from '../interfaces/sticker.interface';

interface RowsResponse<T> {
  status: number;
  rows: T[];
}

@Injectable({
  providedIn: 'root'
})
export class StickerService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/stickers`;

  getCategories(): Observable<StickerCategory[]> {
    return this.http.get<RowsResponse<StickerCategory>>(`${this.baseUrl}/categories`).pipe(
      map((response) => Array.isArray(response.rows) ? response.rows : [])
    );
  }

  getPacks(categoryId: string): Observable<StickerPack[]> {
    return this.http.get<RowsResponse<StickerPack>>(
      `${this.baseUrl}/categories/${encodeURIComponent(categoryId)}/packs`
    ).pipe(
      map((response) => Array.isArray(response.rows) ? response.rows : [])
    );
  }

  getStickers(packId: string): Observable<Sticker[]> {
    return this.http.get<RowsResponse<Sticker>>(
      `${this.baseUrl}/packs/${encodeURIComponent(packId)}/stickers`
    ).pipe(
      map((response) => Array.isArray(response.rows) ? response.rows : [])
    );
  }

  getRenderUrl(stickerId: string, variant: 'preview' | 'chat' = 'chat'): string {
    return `${this.baseUrl}/render/${encodeURIComponent(stickerId)}?variant=${encodeURIComponent(variant)}`;
  }

  getPackLicenseUrl(packId: string): string {
    return `${this.baseUrl}/packs/${encodeURIComponent(packId)}/license`;
  }

  async fetchPackLicenseUrl(packId: string): Promise<string | null> {
    try {
      const response = await fetch(this.getPackLicenseUrl(packId), {
        credentials: 'same-origin'
      });
      if (!response.ok) {
        return null;
      }

      const blob = await response.blob();
      if (!blob.size) {
        return null;
      }

      return window.URL.createObjectURL(blob);
    } catch {
      return null;
    }
  }

  createStickerMultimedia(sticker: Sticker): Multimedia {
    const renderUrl = this.getRenderUrl(sticker.id, 'chat');
    return {
      type: MultimediaType.STICKER,
      url: renderUrl,
      contentId: sticker.id,
      sourceUrl: renderUrl,
      attribution: '',
      title: sticker.name || '',
      description: '',
      oembed: undefined
    };
  }
}
