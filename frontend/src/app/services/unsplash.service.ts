import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { UnsplashApiResponse, UnsplashPhoto, UnsplashSearchResults } from '../interfaces/unsplash-response';
import { NetworkService } from './network.service';
import { TranslationHelperService } from './translation-helper.service';

@Injectable({
  providedIn: 'root'
})
export class UnsplashService {
  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      withCredentials: 'true'
    })
  };

  private readonly http = inject(HttpClient);
  private readonly networkService = inject(NetworkService);
  private readonly i18n = inject(TranslationHelperService);

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  getFeaturedPhotos(page?: number | string, showAlways = true): Observable<UnsplashApiResponse<UnsplashPhoto[]>> {
    const base = `${environment.apiUrl}/unsplash/featured`;
    const pageValue = page !== undefined && page !== null ? String(page).trim() : '';
    const url = pageValue.length > 0 ? `${base}/${encodeURIComponent(pageValue)}` : base;

    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: this.i18n.t('common.unsplash.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.unsplash.loading'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
    });

    return this.http.get<UnsplashApiResponse<UnsplashPhoto[]>>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  searchPhotos(searchTerm: string, page?: number | string, showAlways = true): Observable<UnsplashApiResponse<UnsplashSearchResults>> {
    const base = `${environment.apiUrl}/unsplash/search/${encodeURIComponent(searchTerm)}`;
    const pageValue = page !== undefined && page !== null ? String(page).trim() : '';
    const url = pageValue.length > 0 ? `${base}/${encodeURIComponent(pageValue)}` : base;

    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: this.i18n.t('common.unsplash.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.unsplash.loading'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
    });

    return this.http.get<UnsplashApiResponse<UnsplashSearchResults>>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  trackDownload(downloadLocation: string): Observable<UnsplashApiResponse<unknown>> {
    const url = `${environment.apiUrl}/unsplash/download`;
    return this.http.post<UnsplashApiResponse<unknown>>(url, { downloadLocation }, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }
}
