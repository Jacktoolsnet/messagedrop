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
import { UserService } from './user.service';

interface RowsResponse<T> {
  status: number;
  rows: T[];
}

interface RenderSessionResponse {
  status: number;
  token?: string;
  expiresAt?: number;
}

interface RenderAccessTokenOptions {
  preferGuestSession?: boolean;
  forceRefreshGuestSession?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class StickerService {
  private readonly http = inject(HttpClient);
  private readonly userService = inject(UserService);
  private readonly baseUrl = `${environment.apiUrl}/stickers`;
  private readonly renderSessionUrl = `${this.baseUrl}/render-session`;
  private bootstrapRequest?: Observable<StickerBootstrapCategory[]>;
  private renderSession?: { token: string; expiresAt: number };
  private renderSessionRequest?: Promise<string>;

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

  getRenderUrl(stickerId: string, variant: 'preview' | 'chat' = 'preview'): string {
    return `${this.baseUrl}/render/${encodeURIComponent(stickerId)}?variant=${encodeURIComponent(variant)}`;
  }

  resolveStickerId(multimedia: Pick<Multimedia, 'type' | 'contentId' | 'url'> | null | undefined): string | null {
    if (!multimedia || multimedia.type !== MultimediaType.STICKER) {
      return null;
    }

    const contentId = typeof multimedia.contentId === 'string' ? multimedia.contentId.trim() : '';
    if (contentId) {
      return contentId;
    }

    return this.extractStickerIdFromUrl(multimedia.url);
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

  async fetchRenderObjectUrl(
    stickerId: string,
    variant: 'preview' | 'chat' = 'preview',
    abortSignal?: AbortSignal
  ): Promise<string> {
    if (!stickerId) {
      return '';
    }

    try {
      let response = await this.requestRenderResponse(stickerId, variant, {
        token: await this.getRenderAccessToken(),
        abortSignal
      });

      if ((response.status === 401 || response.status === 403) && !abortSignal?.aborted) {
        response = await this.requestRenderResponse(stickerId, variant, {
          token: await this.getRenderAccessToken({
            preferGuestSession: true,
            forceRefreshGuestSession: true
          }),
          abortSignal
        });
      }

      if (!response.ok) {
        return '';
      }

      const blob = await response.blob();
      if (!blob.size) {
        return '';
      }

      return window.URL.createObjectURL(blob);
    } catch {
      return '';
    }
  }

  createStickerMultimedia(sticker: Sticker): Multimedia {
    const renderUrl = this.getRenderUrl(sticker.id, 'preview');
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

  private extractStickerIdFromUrl(url: string | null | undefined): string | null {
    if (!url) {
      return null;
    }

    try {
      const parsedUrl = new URL(url, window.location.origin);
      const match = parsedUrl.pathname.match(/\/stickers\/render\/([^/]+)/i);
      return match?.[1] ? decodeURIComponent(match[1]) : null;
    } catch {
      return null;
    }
  }

  private async getRenderAccessToken(options?: RenderAccessTokenOptions): Promise<string> {
    const preferGuestSession = options?.preferGuestSession === true;
    if (!preferGuestSession && this.userService.hasJwt()) {
      const jwt = this.userService.getUser().jwt;
      if (jwt) {
        return jwt;
      }
    }

    return this.getRenderSessionToken(options?.forceRefreshGuestSession === true);
  }

  private async getRenderSessionToken(forceRefresh = false): Promise<string> {
    const cachedToken = this.renderSession;
    if (!forceRefresh && cachedToken && cachedToken.expiresAt - Date.now() > 15_000) {
      return cachedToken.token;
    }

    if (!forceRefresh && this.renderSessionRequest) {
      return this.renderSessionRequest;
    }

    const request = firstValueFrom(this.http.post<RenderSessionResponse>(this.renderSessionUrl, {})).then((response) => {
      const token = typeof response?.token === 'string' ? response.token.trim() : '';
      if (!token) {
        throw new Error('Missing sticker render token');
      }

      const expiresAt = Number.isFinite(response?.expiresAt)
        ? Number(response.expiresAt)
        : Date.now() + 60_000;

      this.renderSession = { token, expiresAt };
      return token;
    }).finally(() => {
      if (this.renderSessionRequest === request) {
        this.renderSessionRequest = undefined;
      }
    });

    this.renderSessionRequest = request;
    return request;
  }

  private requestRenderResponse(
    stickerId: string,
    variant: 'preview' | 'chat',
    options: { token: string; abortSignal?: AbortSignal }
  ): Promise<Response> {
    return fetch(this.getRenderUrl(stickerId, variant), {
      headers: {
        Authorization: `Bearer ${options.token}`,
        Accept: 'image/*'
      },
      signal: options.abortSignal
    });
  }
}
