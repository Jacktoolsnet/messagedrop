import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, map, Observable, shareReplay, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Multimedia } from '../interfaces/multimedia';
import { MultimediaType } from '../interfaces/multimedia-type';
import { StickerBootstrapCategory } from '../interfaces/sticker-bootstrap.interface';
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
  private bootstrapRequest?: Observable<StickerBootstrapCategory[]>;

  getBootstrap(): Observable<StickerBootstrapCategory[]> {
    if (!this.bootstrapRequest) {
      this.bootstrapRequest = this.http.get<RowsResponse<StickerBootstrapCategory>>(`${this.baseUrl}/bootstrap`).pipe(
        map((response) => Array.isArray(response.rows) ? response.rows : []),
        tap({
          error: () => {
            this.bootstrapRequest = undefined;
          }
        }),
        shareReplay(1)
      );
    }
    return this.bootstrapRequest;
  }

  getCategories(): Observable<StickerCategory[]> {
    return this.getBootstrap().pipe(
      map((categories) => categories.map(({ packs: _packs, ...category }) => category))
    );
  }

  getPacks(categoryId: string): Observable<StickerPack[]> {
    return this.getBootstrap().pipe(
      map((categories) => {
        const category = categories.find((entry) => entry.id === categoryId);
        if (!category) {
          return [];
        }

        return category.packs.map(({ stickers: _stickers, ...pack }) => pack);
      })
    );
  }

  getStickers(packId: string): Observable<Sticker[]> {
    return this.getBootstrap().pipe(
      map((categories) => {
        for (const category of categories) {
          const pack = category.packs.find((entry) => entry.id === packId);
          if (pack) {
            return pack.stickers;
          }
        }

        return [];
      })
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
      const blob = await firstValueFrom(this.http.get(this.getPackLicenseUrl(packId), {
        responseType: 'blob'
      }));
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
