import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { GetNominatimAddressResponse } from '../interfaces/get-nominatim-address-response copy';
import { Location } from '../interfaces/location';
import { NominatimPlace } from '../interfaces/nominatim-place';
import { NetworkService } from './network.service';

@Injectable({
  providedIn: 'root'
})
export class NominatimService {
  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${environment.apiToken}`,
      withCredentials: 'true'
    })
  };

  constructor(
    private http: HttpClient,
    private networkService: NetworkService
  ) { }

  private handleError(error: HttpErrorResponse) {
    // Return an observable with a user-facing error message.
    return throwError(() => error);
  }

  getAddressByLocation(location: Location): Observable<GetNominatimAddressResponse> {
    const url = `${environment.apiUrl}/nominatim/${location.plusCode}/${location.latitude}/${location.longitude}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: false,
      title: 'Nominatim service',
      image: '',
      icon: '',
      message: 'Fetching nominatim data',
      button: '',
      delay: 0,
      showSpinner: true
    });

    return this.http.get<GetNominatimAddressResponse>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  getAddressBySearchTerm(searchTerm: string, limit = 1): Observable<NominatimPlace[]> {
    const encodedTerm = encodeURIComponent(searchTerm);
    const url = `${environment.apiUrl}/nominatim/search/${encodedTerm}/${limit}`;

    this.networkService.setNetworkMessageConfig(url, {
      showAlways: false,
      title: 'Searching location',
      image: '',
      icon: '',
      message: `Searching for "${searchTerm}"`,
      button: '',
      delay: 0,
      showSpinner: true
    });

    return this.http.get<NominatimPlace[]>(url, this.httpOptions).pipe(
      catchError(this.handleError)
    );
  }
}
