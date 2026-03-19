import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UnsplashApiResponse, UnsplashPhoto, UnsplashSearchResults } from '../../interfaces/unsplash-response.interface';

@Injectable({
  providedIn: 'root'
})
export class PublicProfileUnsplashService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/content/avatars/unsplash`;

  getFeaturedPhotos(page = 1): Observable<UnsplashApiResponse<UnsplashPhoto[]>> {
    const params = new HttpParams().set('page', String(Math.max(page, 1)));
    return this.http.get<UnsplashApiResponse<UnsplashPhoto[]>>(`${this.baseUrl}/featured`, { params }).pipe(
      catchError((error) => this.handleError(error))
    );
  }

  searchPhotos(searchTerm: string, page = 1): Observable<UnsplashApiResponse<UnsplashSearchResults>> {
    let params = new HttpParams()
      .set('term', searchTerm.trim())
      .set('page', String(Math.max(page, 1)));

    return this.http.get<UnsplashApiResponse<UnsplashSearchResults>>(`${this.baseUrl}/search`, { params }).pipe(
      catchError((error) => this.handleError(error))
    );
  }

  trackDownload(downloadLocation: string): Observable<boolean> {
    return this.http.post<UnsplashApiResponse<unknown>>(`${this.baseUrl}/download`, { downloadLocation }).pipe(
      map(() => true),
      catchError((error) => this.handleError(error))
    );
  }

  private handleError(error: unknown) {
    if (error instanceof HttpErrorResponse) {
      return throwError(() => error);
    }
    return throwError(() => new Error('Unsplash request failed'));
  }
}
