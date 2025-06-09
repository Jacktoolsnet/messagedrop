import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { GetNominatimAddressResponse } from '../interfaces/get-nominatim-address-response copy';
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

  getAddress(pluscode: string, latitude: number, longitude: number): Observable<GetNominatimAddressResponse> {
    const url = `${environment.apiUrl}/nominatim/${pluscode}/${latitude}/${longitude}`;
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
}
