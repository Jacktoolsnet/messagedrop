import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ViatorFreetextSearchRequest,
  ViatorFreetextSearchResponse,
  ViatorProductSearchRequest,
  ViatorProductSearchResponse
} from '../interfaces/viator';
import { NetworkService } from './network.service';
import { TranslationHelperService } from './translation-helper.service';

@Injectable({
  providedIn: 'root'
})
export class ViatorService {
  private readonly http = inject(HttpClient);
  private readonly networkService = inject(NetworkService);
  private readonly i18n = inject(TranslationHelperService);

  private readonly httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      withCredentials: 'true'
    })
  };

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  getProductTags(showAlways = false): Observable<unknown> {
    const url = `${environment.apiUrl}/viator/products/tags`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways,
      title: this.i18n.t('common.viator.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.viator.loading'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
    });

    return this.http.get<unknown>(url, this.httpOptions)
      .pipe(catchError(this.handleError));
  }

  searchProducts(request: ViatorProductSearchRequest, showAlways = true): Observable<ViatorProductSearchResponse> {
    const url = `${environment.apiUrl}/viator/products/search`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways,
      title: this.i18n.t('common.viator.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.viator.loading'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
    });

    return this.http.post<ViatorProductSearchResponse>(url, request, this.httpOptions)
      .pipe(catchError(this.handleError));
  }

  searchFreetext(request: ViatorFreetextSearchRequest, showAlways = true): Observable<ViatorFreetextSearchResponse> {
    const url = `${environment.apiUrl}/viator/search/freetext`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways,
      title: this.i18n.t('common.viator.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.viator.loading'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
    });

    return this.http.post<ViatorFreetextSearchResponse>(url, request, this.httpOptions)
      .pipe(catchError(this.handleError));
  }

  getProduct(productCode: string, showAlways = false): Observable<unknown> {
    const url = `${environment.apiUrl}/viator/products/${encodeURIComponent(productCode)}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways,
      title: this.i18n.t('common.viator.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.viator.loading'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
    });

    return this.http.get<unknown>(url, this.httpOptions)
      .pipe(catchError(this.handleError));
  }

  searchAttractions(destinationId: number, showAlways = false): Observable<unknown> {
    const url = `${environment.apiUrl}/viator/attractions/search`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways,
      title: this.i18n.t('common.viator.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.viator.loading'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
    });

    return this.http.post<unknown>(url, { destinationId }, this.httpOptions)
      .pipe(catchError(this.handleError));
  }
}
