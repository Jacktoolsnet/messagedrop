import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { catchError, throwError } from 'rxjs';
import { SimpleStatusResponse } from '../interfaces/simple-status-response';
import { Place } from '../interfaces/place';
import { GetPlacesResponse } from '../interfaces/get-places-response';
import { Location } from '../interfaces/location';
import { GetPlacePlusCodeResponse } from '../interfaces/get-place-plus-code-response copy';
import { GetPlaceResponse } from '../interfaces/get-place-response';
import { CreatePlaceResponse } from '../interfaces/create-place-response';
import { UserService } from './user.service';
import { MapService } from './map.service';

@Injectable({
  providedIn: 'root'
})
export class PlaceService {

  public places: Place[] = [];
  private ready: boolean = false;

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${environment.apiToken}`
    })
  };

  constructor(
    private userService: UserService,
    private http: HttpClient) {
    this.initPlaces();
  }

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  async initPlaces() {
    while (!this.userService.isReady) {
      await new Promise(f => setTimeout(f, 500));
    }
    this.getByUserId(this.userService.getUser().id)
      .subscribe({
        next: (getPlacesResponse: GetPlacesResponse) => {
          this.places = [...getPlacesResponse.rows];
          this.ready = true;
          this.places.forEach(place => {
            this.getPlacePlusCodes(place)
              .subscribe({
                next: (getPlacesPluscodeResponse: GetPlacePlusCodeResponse) => {
                  place.plusCodes = [...getPlacesPluscodeResponse.rows];
                },
                error: (err) => { },
                complete: () => { }
              });
          });
        },
        error: (err) => {
          if (err.status === 404) {
            this.places = [];
            this.ready = true;
          } else {
            this.ready = false;
          }
        },
        complete: () => { }
      });
  }

  getPlaces(): Place[] {
    return this.places;
  }

  isReady(): boolean {
    return this.ready;
  }

  createPlace(place: Place) {
    let body = {
      'userId': place.userId,
      'name': place.name,
    };
    return this.http.post<CreatePlaceResponse>(`${environment.apiUrl}/place/create`, body, this.httpOptions)
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
    return this.http.get<GetPlacesResponse>(`${environment.apiUrl}/place/get/userId/${userId}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  getById(placeId: string) {
    return this.http.get<GetPlaceResponse>(`${environment.apiUrl}/place/get/${placeId}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  getByUserIdAndName(userId: string, name: string) {
    return this.http.get<GetPlaceResponse>(`${environment.apiUrl}/place/get/userId/${userId}/name/${name}`, this.httpOptions)
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

  subscribe(place: Place) {
    return this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/place/subscribe/${place.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  unsubscribe(place: Place) {
    return this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/place/unsubscribe/${place.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  addPlusCodeToPlace(place: Place, location: Location, isPartOfPlace: boolean, mapService: MapService) {
    this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/placepluscode/create/${place.id}/${location.plusCode}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: (simpleStatusResponse) => {
          if (simpleStatusResponse.status === 200) {
            place.plusCodes.push({
              placeId: place.id,
              plusCode: location.plusCode
            });
            mapService.addPlaceLocationRectange(location);
            isPartOfPlace = true;
          }
        },
        error: (err) => {
          isPartOfPlace = false;
        },
        complete: () => { }
      });;
  }

  removePlusCodeFromPlace(place: Place, location: Location, isPartOfPlace: boolean, mapService: MapService) {
    this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/placepluscode/remove/${place.id}/${location.plusCode}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: (simpleStatusResponse) => {
          if (simpleStatusResponse.status === 200) {
            place.plusCodes.splice(place.plusCodes.findIndex(item => item.plusCode === location.plusCode), 1)
            isPartOfPlace = false;
            mapService.removePlaceLocationRectange(location);
          }
        },
        error: (err) => {
          isPartOfPlace = true;
        },
        complete: () => { }
      });
  }

  getPlacePlusCodes(place: Place) {
    return this.http.get<GetPlacePlusCodeResponse>(`${environment.apiUrl}/placepluscode/byPlaceId/${place.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }
}
