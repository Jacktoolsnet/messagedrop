import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, finalize, map, Observable, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ExternalPublicContent } from '../../interfaces/external-public-content.interface';
import { Multimedia } from '../../interfaces/multimedia.interface';
import { PublicContentFilters } from '../../interfaces/public-content-filters.interface';
import { PublicContentReactionState } from '../../interfaces/public-content-reaction-state.interface';
import { PublicContentSavePayload } from '../../interfaces/public-content-save-payload.interface';
import { PublicContent } from '../../interfaces/public-content.interface';
import { TenorApiResponse } from '../../interfaces/tenor-response.interface';
import { TranslationHelperService } from '../translation-helper.service';
import { DisplayMessageService } from '../display-message.service';

interface PublicContentListResponse {
  status: number;
  rows: PublicContent[];
}

interface PublicContentRowResponse {
  status: number;
  row: PublicContent;
}

interface PublicContentReactionStateResponse {
  status: number;
  row: PublicContentReactionState;
}

interface ExternalPublicContentListResponse {
  status: number;
  rows: ExternalPublicContent[];
}

interface ExternalPublicContentRowResponse {
  status: number;
  row: ExternalPublicContent;
}

@Injectable({
  providedIn: 'root'
})
export class PublicContentService {
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(DisplayMessageService);
  private readonly i18n = inject(TranslationHelperService);
  private readonly baseUrl = `${environment.apiUrl}/content`;

  private readonly _rows = signal<PublicContent[]>([]);
  readonly rows = this._rows.asReadonly();

  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  loadPublicContent(filters: PublicContentFilters = {}): void {
    this._loading.set(true);

    this.listPublicContent(filters).pipe(
      catchError((error) => {
        this.handleError(error, 'Could not load public content.');
        return of([]);
      }),
      finalize(() => this._loading.set(false))
    ).subscribe((rows) => {
      this._rows.set(rows);
    });
  }

  listPublicContent(filters: PublicContentFilters = {}): Observable<PublicContent[]> {
    return this.http.get<PublicContentListResponse>(`${this.baseUrl}/public-messages`, {
      params: this.buildListParams(filters)
    }).pipe(
      map((response) => response.rows ?? [])
    );
  }

  getPublicContent(id: string): Observable<PublicContent> {
    return this.http.get<PublicContentRowResponse>(`${this.baseUrl}/public-messages/${encodeURIComponent(id)}`).pipe(
      map((response) => response.row),
      catchError((error) => this.handleError(error, 'Could not load public content.'))
    );
  }

  getExternalCommentsForContent(id: string): Observable<ExternalPublicContent[]> {
    return this.http.get<ExternalPublicContentListResponse>(`${this.baseUrl}/public-messages/${encodeURIComponent(id)}/external-comments`).pipe(
      map((response) => response.rows ?? []),
      catchError((error) => this.handleError(error, 'Could not load public comments.'))
    );
  }

  getExternalPublicContent(messageUuid: string): Observable<ExternalPublicContent> {
    return this.http.get<ExternalPublicContentRowResponse>(`${this.baseUrl}/external-public-content/${encodeURIComponent(messageUuid)}`).pipe(
      map((response) => response.row),
      catchError((error) => this.handleError(error, 'Could not load the public comment.'))
    );
  }

  getPublicContentReactions(id: string): Observable<PublicContentReactionState> {
    return this.http.get<PublicContentReactionStateResponse>(`${this.baseUrl}/public-messages/${encodeURIComponent(id)}/reactions`).pipe(
      map((response) => response.row),
      catchError((error) => this.handleError(error, 'Could not load public reactions.'))
    );
  }

  togglePublicContentReaction(id: string, publicProfileId: string, reaction: 'like' | 'dislike'): Observable<PublicContentReactionState> {
    return this.http.post<PublicContentReactionStateResponse>(
      `${this.baseUrl}/public-messages/${encodeURIComponent(id)}/reactions/${encodeURIComponent(publicProfileId)}/${reaction}`,
      {}
    ).pipe(
      map((response) => response.row),
      catchError((error) => this.handleError(error, 'Could not update public reaction.'))
    );
  }

  createPublicContent(payload: PublicContentSavePayload): Observable<PublicContent> {
    return this.http.post<PublicContentRowResponse>(`${this.baseUrl}/public-messages`, payload).pipe(
      map((response) => response.row),
      catchError((error) => this.handleError(error, 'Could not save public content.'))
    );
  }

  updatePublicContent(id: string, payload: PublicContentSavePayload): Observable<PublicContent> {
    return this.http.put<PublicContentRowResponse>(`${this.baseUrl}/public-messages/${encodeURIComponent(id)}`, payload).pipe(
      map((response) => response.row),
      catchError((error) => this.handleError(error, 'Could not update public content.'))
    );
  }

  publishPublicContent(id: string): Observable<PublicContent> {
    return this.http.post<PublicContentRowResponse>(`${this.baseUrl}/public-messages/${encodeURIComponent(id)}/publish`, {}).pipe(
      map((response) => response.row),
      catchError((error) => this.handleError(error, 'Could not publish public content.'))
    );
  }

  withdrawPublicContent(id: string): Observable<PublicContent> {
    return this.http.post<PublicContentRowResponse>(`${this.baseUrl}/public-messages/${encodeURIComponent(id)}/withdraw`, {}).pipe(
      map((response) => response.row),
      catchError((error) => this.handleError(error, 'Could not withdraw public content.'))
    );
  }

  deletePublicContent(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ status: number; deleted: boolean }>(`${this.baseUrl}/public-messages/${encodeURIComponent(id)}`).pipe(
      map((response) => ({ deleted: response.deleted === true })),
      catchError((error) => this.handleError(error, 'Could not delete public content.'))
    );
  }

  restorePublicContent(id: string): Observable<PublicContent> {
    return this.http.post<PublicContentRowResponse>(`${this.baseUrl}/public-messages/${encodeURIComponent(id)}/restore`, {}).pipe(
      map((response) => response.row),
      catchError((error) => this.handleError(error, 'Could not restore public content.'))
    );
  }

  getFeaturedKlipy(next = '', kind: 'gif' | 'sticker' | 'clip' | 'meme' = 'gif'): Observable<TenorApiResponse> {
    let params = new HttpParams().set('kind', kind);
    if (next) {
      params = params.set('next', next);
    }
    return this.http.get<TenorApiResponse>(`${this.baseUrl}/media/klipy/featured`, { params }).pipe(
      catchError((error) => this.handleError(error, 'Could not load Klipy results.'))
    );
  }

  searchKlipy(term: string, next = '', kind: 'gif' | 'sticker' | 'clip' | 'meme' = 'gif'): Observable<TenorApiResponse> {
    let params = new HttpParams().set('term', term).set('kind', kind);
    if (next) {
      params = params.set('next', next);
    }
    return this.http.get<TenorApiResponse>(`${this.baseUrl}/media/klipy/search`, { params }).pipe(
      catchError((error) => this.handleError(error, 'Could not search Klipy.'))
    );
  }

  getFeaturedTenor(next = ''): Observable<TenorApiResponse> {
    return this.getFeaturedKlipy(next);
  }

  searchTenor(term: string, next = ''): Observable<TenorApiResponse> {
    return this.searchKlipy(term, next);
  }

  resolveOembed(url: string): Observable<Multimedia> {
    return this.http.get<{ status: number; multimedia: Multimedia }>(`${this.baseUrl}/media/oembed`, {
      params: new HttpParams().set('url', url)
    }).pipe(
      map((response) => response.multimedia),
      catchError((error) => this.handleError(error, 'Could not import external media.'))
    );
  }

  previewOembed(url: string): Observable<Multimedia | null> {
    return this.http.get<{ status: number; multimedia: Multimedia }>(`${this.baseUrl}/media/oembed`, {
      params: new HttpParams().set('url', url)
    }).pipe(
      map((response) => response.multimedia ?? null),
      catchError(() => of(null))
    );
  }

  private buildListParams(filters: PublicContentFilters): HttpParams {
    let params = new HttpParams();

    if (filters.status && filters.status !== 'all') {
      params = params.set('status', filters.status);
    }
    if (filters.contentType && filters.contentType !== 'all') {
      params = params.set('contentType', filters.contentType);
    }
    if (filters.parentContentId?.trim()) {
      params = params.set('parentContentId', filters.parentContentId.trim());
    }
    if (filters.q?.trim()) {
      params = params.set('q', filters.q.trim());
    }
    if (filters.publicProfileId?.trim()) {
      params = params.set('publicProfileId', filters.publicProfileId.trim());
    }
    if (Number.isFinite(filters.limit)) {
      params = params.set('limit', String(filters.limit));
    }
    if (Number.isFinite(filters.offset)) {
      params = params.set('offset', String(filters.offset));
    }

    return params;
  }

  private handleError(error: unknown, message: string) {
    this.snackBar.open(this.resolveErrorMessage(error, message), this.i18n.t('OK'), {
      duration: 3000,
      panelClass: ['snack-error'],
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
    return throwError(() => error);
  }

  private resolveErrorMessage(error: unknown, fallbackMessage: string): string {
    if (error instanceof HttpErrorResponse) {
      const backendMessage = error.error?.message || error.error?.error || error.message;
      if (typeof backendMessage === 'string' && backendMessage.trim()) {
        return this.i18n.t(backendMessage.trim());
      }
    }
    return this.i18n.t(fallbackMessage);
  }
}
