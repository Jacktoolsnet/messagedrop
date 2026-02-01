import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ViatorFreetextSearchRequest,
  ViatorFreetextSearchResponse,
  ViatorDestinationsResponse,
  ViatorLocationsResponse,
  ViatorProductDetail,
  ViatorProductSearchRequest,
  ViatorProductSearchResponse,
  ViatorSuppliersResponse
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

  getProduct(productCode: string, showAlways = false): Observable<ViatorProductDetail> {
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

    return this.http.get<ViatorProductDetail>(url, this.httpOptions)
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

  getDestinations(ids: number[], showAlways = false): Observable<ViatorDestinationsResponse> {
    const sanitized = Array.isArray(ids)
      ? Array.from(new Set(ids.filter((id) => Number.isFinite(id) && id > 0)))
      : [];
    const url = `${environment.apiUrl}/viator/destinations`;
    const params = new HttpParams().set('ids', sanitized.join(','));

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

    return this.http.get<ViatorDestinationsResponse>(url, { ...this.httpOptions, params })
      .pipe(catchError(this.handleError));
  }

  getAllDestinations(showAlways = false): Observable<ViatorDestinationsResponse> {
    const url = `${environment.apiUrl}/viator/destinations/all`;
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

    return this.http.get<ViatorDestinationsResponse>(url, this.httpOptions)
      .pipe(catchError(this.handleError));
  }

  getLocationsBulk(references: string[], showAlways = false): Observable<ViatorLocationsResponse> {
    const locations = Array.isArray(references)
      ? Array.from(new Set(references.map((ref) => String(ref).trim()).filter(Boolean)))
      : [];
    const url = `${environment.apiUrl}/viator/locations/bulk`;
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

    return this.http.post<ViatorLocationsResponse>(url, { locations }, this.httpOptions)
      .pipe(catchError(this.handleError));
  }

  getSuppliersByProductCodes(productCodes: string[], showAlways = false): Observable<ViatorSuppliersResponse> {
    const codes = Array.isArray(productCodes)
      ? Array.from(new Set(productCodes.map((code) => String(code).trim()).filter(Boolean)))
      : [];
    const url = `${environment.apiUrl}/viator/suppliers/search/product-codes`;
    const options = {
      ...this.httpOptions,
      headers: this.httpOptions.headers.set('x-skip-ui', 'true')
    };
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

    return this.http.post<ViatorSuppliersResponse>(url, { productCodes: codes }, options)
      .pipe(catchError(this.handleError));
  }
}
