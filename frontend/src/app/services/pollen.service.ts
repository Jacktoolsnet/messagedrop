import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { Pollen } from '../interfaces/pollen';
import { NetworkService } from './network.service';

@Injectable({
  providedIn: 'root'
})
export class PollenService {
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
    console.error('PollenService error:', error);
    return throwError(() => new Error('Failed to fetch pollen data.'));
  }

  getPollen(pluscode: string, latitude: number, longitude: number, days: number): Observable<Pollen> {
    const url = `${environment.apiUrl}/pollen/${pluscode}/${latitude}/${longitude}/${days}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: true,
      title: 'Pollen Service',
      image: '',
      icon: 'nature',
      message: 'Fetching pollen data...',
      button: '',
      delay: 0,
      showSpinner: true
    });

    return this.http.get<{ status: number, data: Pollen }>(url, this.httpOptions)
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }
}