import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { GifApiResponse } from '../interfaces/gif-response';
import { NetworkService } from './network.service';
import { TranslationHelperService } from './translation-helper.service';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root'
})
export class GifService {

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      withCredentials: 'true'
    })
  };

  private readonly http = inject(HttpClient);
  private readonly userService = inject(UserService);
  private readonly networkService = inject(NetworkService);
  private readonly i18n = inject(TranslationHelperService);

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  getFeaturedGifs(next: string, showAlways = true): Observable<GifApiResponse> {
    const base = `${environment.apiUrl}/klipy/featured/${this.userService.getUser().language}/${this.userService.getUser().locale.replace('-', '_')}`;
    const url = !!next && next.trim().length > 0 ? `${base}/${encodeURIComponent(next)}` : base;

    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: this.i18n.t('common.klipy.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.klipy.loading'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
    });
    return this.http.get<GifApiResponse>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
  }

  searchGifs(searchTerm: string, next: string, showAlways = true): Observable<GifApiResponse> {
    const base = `${environment.apiUrl}/klipy/search/${this.userService.getUser().language}/${this.userService.getUser().locale.replace('-', '_')}/${encodeURIComponent(searchTerm)}`;
    const url = !!next && next.trim().length > 0 ? `${base}/${encodeURIComponent(next)}` : base;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: this.i18n.t('common.klipy.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.klipy.loading'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
    });
    return this.http.get<GifApiResponse>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
  }
}
