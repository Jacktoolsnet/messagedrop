import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, finalize, map, Observable, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { StickerCategory } from '../../interfaces/sticker-category.interface';
import { StickerImportResult } from '../../interfaces/sticker-import-result.interface';
import { StickerPack } from '../../interfaces/sticker-pack.interface';
import { StickerSettings } from '../../interfaces/sticker-settings.interface';
import { Sticker } from '../../interfaces/sticker.interface';
import { StickerSourceMetadata } from '../../interfaces/sticker-source-metadata.interface';
import { getValidStoredAdminToken } from '../../utils/admin-token.util';
import { DisplayMessageService } from '../display-message.service';
import { TranslationHelperService } from '../translation-helper.service';

interface RowsResponse<T> {
  status: number;
  rows: T[];
}

interface RowResponse<T> {
  status: number;
  row: T;
  deleted?: boolean;
}

interface FlaticonResolveResponse {
  status: number;
  sourceProvider: string;
  metadata: StickerSourceMetadata;
  suggested: {
    name: string;
    sourceProvider: string;
    sourceReference: string;
    licenseNote: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class StickerAdminService {
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(DisplayMessageService);
  private readonly i18n = inject(TranslationHelperService);
  private readonly baseUrl = `${environment.apiUrl}/stickers`;

  private readonly _categories = signal<StickerCategory[]>([]);
  readonly categories = this._categories.asReadonly();

  private readonly _packs = signal<StickerPack[]>([]);
  readonly packs = this._packs.asReadonly();

  private readonly _stickers = signal<Sticker[]>([]);
  readonly stickers = this._stickers.asReadonly();

  private readonly _settings = signal<StickerSettings | null>(null);
  readonly settings = this._settings.asReadonly();

  private readonly _loadingCategories = signal(false);
  readonly loadingCategories = this._loadingCategories.asReadonly();

  private readonly _loadingPacks = signal(false);
  readonly loadingPacks = this._loadingPacks.asReadonly();

  private readonly _loadingStickers = signal(false);
  readonly loadingStickers = this._loadingStickers.asReadonly();

  loadCategories(): void {
    this._loadingCategories.set(true);
    this.http.get<RowsResponse<StickerCategory>>(`${this.baseUrl}/categories`).pipe(
      catchError((error) => {
        this.handleError(error, 'Could not load sticker categories.');
        return of({ status: 0, rows: [] as StickerCategory[] });
      }),
      finalize(() => this._loadingCategories.set(false))
    ).subscribe((response) => {
      this._categories.set(Array.isArray(response.rows) ? response.rows : []);
    });
  }

  loadPacks(categoryId: string): void {
    if (!categoryId) {
      this._packs.set([]);
      return;
    }

    this._loadingPacks.set(true);
    this.http.get<RowsResponse<StickerPack>>(`${this.baseUrl}/categories/${encodeURIComponent(categoryId)}/packs`).pipe(
      catchError((error) => {
        this.handleError(error, 'Could not load sticker packs.');
        return of({ status: 0, rows: [] as StickerPack[] });
      }),
      finalize(() => this._loadingPacks.set(false))
    ).subscribe((response) => {
      this._packs.set(Array.isArray(response.rows) ? response.rows : []);
    });
  }

  loadStickers(packId: string): void {
    if (!packId) {
      this._stickers.set([]);
      return;
    }

    this._loadingStickers.set(true);
    this.http.get<RowsResponse<Sticker>>(`${this.baseUrl}/packs/${encodeURIComponent(packId)}/stickers`).pipe(
      catchError((error) => {
        this.handleError(error, 'Could not load stickers.');
        return of({ status: 0, rows: [] as Sticker[] });
      }),
      finalize(() => this._loadingStickers.set(false))
    ).subscribe((response) => {
      this._stickers.set(Array.isArray(response.rows) ? response.rows : []);
    });
  }

  loadSettings(): void {
    this.http.get<RowResponse<StickerSettings>>(`${this.baseUrl}/settings`).pipe(
      catchError((error) => {
        this.handleError(error, 'Could not load sticker settings.');
        return of({ status: 0, row: null as StickerSettings | null });
      })
    ).subscribe((response) => {
      this._settings.set(response.row ?? null);
    });
  }

  createCategory(payload: Partial<StickerCategory>): Observable<StickerCategory> {
    return this.http.post<RowResponse<StickerCategory>>(`${this.baseUrl}/categories`, payload).pipe(
      map((response) => response.row),
      catchError((error) => this.handleError(error, 'Could not create sticker category.'))
    );
  }

  updateCategory(id: string, payload: Partial<StickerCategory>): Observable<StickerCategory> {
    return this.http.put<RowResponse<StickerCategory>>(`${this.baseUrl}/categories/${encodeURIComponent(id)}`, payload).pipe(
      map((response) => response.row),
      catchError((error) => this.handleError(error, 'Could not update sticker category.'))
    );
  }

  deleteCategory(id: string): Observable<boolean> {
    return this.http.delete<RowResponse<StickerCategory>>(`${this.baseUrl}/categories/${encodeURIComponent(id)}`).pipe(
      map((response) => response.deleted === true),
      catchError((error) => this.handleError(error, 'Could not delete sticker category.'))
    );
  }

  createPack(payload: Partial<StickerPack>): Observable<StickerPack> {
    return this.http.post<RowResponse<StickerPack>>(`${this.baseUrl}/packs`, payload).pipe(
      map((response) => response.row),
      catchError((error) => this.handleError(error, 'Could not create sticker pack.'))
    );
  }

  updatePack(id: string, payload: Partial<StickerPack>): Observable<StickerPack> {
    return this.http.put<RowResponse<StickerPack>>(`${this.baseUrl}/packs/${encodeURIComponent(id)}`, payload).pipe(
      map((response) => response.row),
      catchError((error) => this.handleError(error, 'Could not update sticker pack.'))
    );
  }

  deletePack(id: string): Observable<boolean> {
    return this.http.delete<RowResponse<StickerPack>>(`${this.baseUrl}/packs/${encodeURIComponent(id)}`).pipe(
      map((response) => response.deleted === true),
      catchError((error) => this.handleError(error, 'Could not delete sticker pack.'))
    );
  }

  updateSticker(id: string, payload: Partial<Sticker>): Observable<Sticker> {
    return this.http.put<RowResponse<Sticker>>(`${this.baseUrl}/stickers/${encodeURIComponent(id)}`, payload).pipe(
      map((response) => response.row),
      catchError((error) => this.handleError(error, 'Could not update sticker.'))
    );
  }

  deleteSticker(id: string): Observable<boolean> {
    return this.http.delete<RowResponse<Sticker>>(`${this.baseUrl}/stickers/${encodeURIComponent(id)}`).pipe(
      map((response) => response.deleted === true),
      catchError((error) => this.handleError(error, 'Could not delete sticker.'))
    );
  }

  resolveFlaticonMetadata(sourceUrl: string): Observable<FlaticonResolveResponse> {
    return this.http.post<FlaticonResolveResponse>(`${this.baseUrl}/flaticon/resolve`, { sourceUrl }).pipe(
      catchError((error) => this.handleError(error, 'Could not resolve Flaticon metadata.'))
    );
  }

  importSvgFiles(packId: string, files: File[]): Observable<StickerImportResult> {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file, file.name);
    }
    return this.http.post<StickerImportResult>(`${this.baseUrl}/packs/${encodeURIComponent(packId)}/import-svg`, formData).pipe(
      catchError((error) => this.handleError(error, 'Could not import SVG files.'))
    );
  }

  uploadPackLicenseFile(packId: string, file: File): Observable<StickerPack> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<RowResponse<StickerPack>>(`${this.baseUrl}/packs/${encodeURIComponent(packId)}/license`, formData).pipe(
      map((response) => response.row),
      catchError((error) => this.handleError(error, 'Could not upload sticker pack license.'))
    );
  }

  async fetchStickerPreviewUrl(stickerId: string, abortSignal?: AbortSignal): Promise<string> {
    const token = getValidStoredAdminToken();
    if (!token) {
      return '';
    }

    const response = await fetch(`${this.baseUrl}/render/${encodeURIComponent(stickerId)}?variant=preview`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      signal: abortSignal
    });

    if (!response.ok) {
      return '';
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }

  async fetchPackLicenseUrl(packId: string, abortSignal?: AbortSignal): Promise<string> {
    const token = getValidStoredAdminToken();
    if (!token) {
      return '';
    }

    const response = await fetch(`${this.baseUrl}/packs/${encodeURIComponent(packId)}/license`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/pdf'
      },
      signal: abortSignal
    });

    if (!response.ok) {
      return '';
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }

  private handleError(error: unknown, fallbackMessage: string) {
    this.snackBar.open(this.resolveErrorMessage(error, fallbackMessage), this.i18n.t('OK'), {
      duration: 3200,
      panelClass: ['snack-error'],
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
    return throwError(() => error);
  }

  private resolveErrorMessage(error: unknown, fallbackMessage: string): string {
    if (error instanceof HttpErrorResponse) {
      const message = error.error?.message || error.error?.error || error.message;
      if (typeof message === 'string' && message.trim()) {
        return message.trim();
      }
    }
    return this.i18n.t(fallbackMessage);
  }
}
