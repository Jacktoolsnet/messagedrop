import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { catchError, throwError } from 'rxjs';
import { GeolocationService } from './geolocation.service';
import { SimpleStatusResponse } from '../interfaces/simple-status-response';
import { Place } from '../interfaces/place';
import { GetPlaceResponse } from '../interfaces/get-place-response';


@Injectable({
  providedIn: 'root'
})
export class PlaceService {

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type':  'application/json',
      Authorization: `Bearer ${environment.apiToken}`
    })
  };

  constructor(private http: HttpClient, private geolocationService: GeolocationService) { }

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  createPlace(place: Place) {
    let body = {
      'userId': place.userId,
      'name': place.name,
    };
    return this.http.post<SimpleStatusResponse>(`${environment.apiUrl}/place/create`, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  updatePlace(place: Place) {
    let body = {
      'id': place.id,
      'name': place.name
    };
    return this.http.post<SimpleStatusResponse>(`${environment.apiUrl}/place/update`, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  getByUserId(userId: string) {
    return this.http.get<GetPlaceResponse>(`${environment.apiUrl}/place/get/userId/${userId}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  deletePlace(place: Place) {
    return this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/place/delete/${place.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }
}
