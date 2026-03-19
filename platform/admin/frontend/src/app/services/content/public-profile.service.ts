import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, finalize, map, Observable, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PublicProfileSavePayload } from '../../interfaces/public-profile-save-payload.interface';
import { PublicProfile } from '../../interfaces/public-profile.interface';

interface PublicProfileListResponse {
  status: number;
  rows: PublicProfile[];
}

interface PublicProfileRowResponse {
  status: number;
  row: PublicProfile;
}

@Injectable({
  providedIn: 'root'
})
export class PublicProfileService {
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);
  private readonly baseUrl = `${environment.apiUrl}/content/public-profiles`;

  private readonly _rows = signal<PublicProfile[]>([]);
  readonly rows = this._rows.asReadonly();

  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  loadProfiles(): void {
    this._loading.set(true);
    this.http.get<PublicProfileListResponse>(this.baseUrl).pipe(
      catchError((error) => {
        this.handleError(error, 'Could not load public profiles.');
        return of({ status: 0, rows: [] });
      }),
      finalize(() => this._loading.set(false))
    ).subscribe((response) => {
      this._rows.set(Array.isArray(response.rows) ? response.rows : []);
    });
  }

  createProfile(payload: PublicProfileSavePayload): Observable<PublicProfile> {
    return this.http.post<PublicProfileRowResponse>(this.baseUrl, payload).pipe(
      map((response) => response.row),
      catchError((error) => this.handleError(error, 'Could not create public profile.'))
    );
  }

  updateProfile(id: string, payload: PublicProfileSavePayload): Observable<PublicProfile> {
    return this.http.put<PublicProfileRowResponse>(`${this.baseUrl}/${encodeURIComponent(id)}`, payload).pipe(
      map((response) => response.row),
      catchError((error) => this.handleError(error, 'Could not update public profile.'))
    );
  }

  deleteProfile(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ status: number; deleted: boolean }>(`${this.baseUrl}/${encodeURIComponent(id)}`).pipe(
      map((response) => ({ deleted: response.deleted === true })),
      catchError((error) => this.handleError(error, 'Could not delete public profile.'))
    );
  }

  private handleError(error: unknown, fallbackMessage: string) {
    this.snackBar.open(this.resolveErrorMessage(error, fallbackMessage), 'OK', {
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
    return fallbackMessage;
  }
}
