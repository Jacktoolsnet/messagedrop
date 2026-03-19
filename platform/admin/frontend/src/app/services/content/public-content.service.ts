import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, finalize, map, Observable, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Multimedia } from '../../interfaces/multimedia.interface';
import { PublicContentFilters } from '../../interfaces/public-content-filters.interface';
import { PublicContentSavePayload } from '../../interfaces/public-content-save-payload.interface';
import { PublicContent } from '../../interfaces/public-content.interface';
import { TenorApiResponse } from '../../interfaces/tenor-response.interface';

interface PublicContentListResponse {
  status: number;
  rows: PublicContent[];
}

interface PublicContentRowResponse {
  status: number;
  row: PublicContent;
}

@Injectable({
  providedIn: 'root'
})
export class PublicContentService {
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);
  private readonly baseUrl = `${environment.apiUrl}/content`;

  private readonly _rows = signal<PublicContent[]>([]);
  readonly rows = this._rows.asReadonly();

  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  loadPublicContent(filters: PublicContentFilters = {}): void {
    this._loading.set(true);

    this.http.get<PublicContentListResponse>(`${this.baseUrl}/public-messages`, {
      params: this.buildListParams(filters)
    }).pipe(
      catchError((error) => {
        this.handleError(error, 'Could not load public content.');
        return of({ status: 0, rows: [] });
      }),
      finalize(() => this._loading.set(false))
    ).subscribe((response) => {
      this._rows.set(response.rows ?? []);
    });
  }

  getPublicContent(id: string): Observable<PublicContent> {
    return this.http.get<PublicContentRowResponse>(`${this.baseUrl}/public-messages/${encodeURIComponent(id)}`).pipe(
      map((response) => response.row),
      catchError((error) => this.handleError(error, 'Could not load public content.'))
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

  getFeaturedTenor(next = ''): Observable<TenorApiResponse> {
    const params = next ? new HttpParams().set('next', next) : undefined;
    return this.http.get<TenorApiResponse>(`${this.baseUrl}/media/tenor/featured`, { params }).pipe(
      catchError((error) => this.handleError(error, 'Could not load Tenor results.'))
    );
  }

  searchTenor(term: string, next = ''): Observable<TenorApiResponse> {
    let params = new HttpParams().set('term', term);
    if (next) {
      params = params.set('next', next);
    }
    return this.http.get<TenorApiResponse>(`${this.baseUrl}/media/tenor/search`, { params }).pipe(
      catchError((error) => this.handleError(error, 'Could not search Tenor.'))
    );
  }

  resolveOembed(url: string): Observable<Multimedia> {
    return this.http.get<{ status: number; multimedia: Multimedia }>(`${this.baseUrl}/media/oembed`, {
      params: new HttpParams().set('url', url)
    }).pipe(
      map((response) => response.multimedia),
      catchError((error) => this.handleError(error, 'Could not import external media.'))
    );
  }

  private buildListParams(filters: PublicContentFilters): HttpParams {
    let params = new HttpParams();

    if (filters.status && filters.status !== 'all') {
      params = params.set('status', filters.status);
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
    this.snackBar.open(this.resolveErrorMessage(error, message), 'OK', {
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
        return backendMessage.trim();
      }
    }
    return fallbackMessage;
  }
}
