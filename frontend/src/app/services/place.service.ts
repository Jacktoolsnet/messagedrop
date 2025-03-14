import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { CreatePlaceResponse } from '../interfaces/create-place-response';
import { GetPlaceResponse } from '../interfaces/get-place-response';
import { GetPlacesResponse } from '../interfaces/get-places-response';
import { Location } from '../interfaces/location';
import { Place } from '../interfaces/place';
import { SimpleStatusResponse } from '../interfaces/simple-status-response';
import { CryptoService } from './crypto.service';
import { MapService } from './map.service';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root'
})
export class PlaceService {

  private places: Place[] = [];
  private additionalPlaceInfos: { id: string, name: string, base64Avatar: string }[] = [];
  private selectedPlace: Place = {
    id: '',
    userId: '',
    name: '',
    base64Avatar: '',
    subscribed: false,
    plusCodes: []
  };
  private ready: boolean = false;

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${environment.apiToken}`
    })
  };

  constructor(
    private userService: UserService,
    private cryptoService: CryptoService,
    private http: HttpClient) {
  }

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  initPlaces() {
    this.loadAdditionalPlaceInfos();
    this.getByUserId(this.userService.getUser().id)
      .subscribe({
        next: (getPlacesResponse: GetPlacesResponse) => {
          getPlacesResponse.rows.forEach(row => {
            let plusCodes: string[] = [];
            if (null !== row.plusCodes && row.plusCodes !== '') {
              if (JSON.parse(row.plusCodes) instanceof Array) {
                plusCodes = [...JSON.parse(row.plusCodes)];
              } else {
                plusCodes.push(JSON.parse(row.plusCodes));
              }
            }
            this.places.push({
              id: row.id,
              userId: row.userId,
              name: this.findAdditionalPlaceInfo(row.id).name,
              base64Avatar: this.findAdditionalPlaceInfo(row.id).base64Avatar,
              subscribed: row.subscribed,
              plusCodes: plusCodes
            });
          });
          this.ready = true;
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

  loadAdditionalPlaceInfos() {
    this.additionalPlaceInfos = JSON.parse(localStorage.getItem('places') || '[]');
  }

  findAdditionalPlaceInfo(placeId: string): { id: string, name: string, base64Avatar: string } {
    const additonalPlaceInfo = this.additionalPlaceInfos.find((additonalPlaceInfo) => additonalPlaceInfo.id === placeId);
    return undefined != additonalPlaceInfo ? additonalPlaceInfo : { id: '', name: '', base64Avatar: '' };
  }

  saveAdditionalPlaceInfos() {
    this.additionalPlaceInfos = [];
    this.places.forEach((place: Place) => {
      this.additionalPlaceInfos.push({ id: place.id, name: place.name, base64Avatar: place.base64Avatar });
    })
    localStorage.setItem('places', JSON.stringify(this.additionalPlaceInfos))
  }

  getPlaces(): Place[] {
    return this.places;
  }

  getSelectedPlace(): Place {
    return this.selectedPlace;
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
    place.plusCodes.push(location.plusCode);
    let body = {
      'id': place.id,
      'pluscodes': JSON.stringify(place.plusCodes)
    };
    this.http.post<SimpleStatusResponse>(`${environment.apiUrl}/place/updatepluscodes`, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: (simpleStatusResponse) => {
          if (simpleStatusResponse.status === 200) {
            mapService.addPlaceLocationRectange(location);
            isPartOfPlace = true;
          }
        },
        error: (err) => {
          place.plusCodes.splice(place.plusCodes.findIndex(item => item === location.plusCode), 1)
          isPartOfPlace = false;
        },
        complete: () => { }
      });;
  }

  removePlusCodeFromPlace(place: Place, location: Location, isPartOfPlace: boolean, mapService: MapService) {
    place.plusCodes.splice(place.plusCodes.findIndex(item => item === location.plusCode), 1)
    let body = {
      'id': place.id,
      'pluscodes': JSON.stringify(place.plusCodes)
    };
    this.http.post<SimpleStatusResponse>(`${environment.apiUrl}/place/updatepluscodes`, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: (simpleStatusResponse) => {
          if (simpleStatusResponse.status === 200) {
            isPartOfPlace = false;
            mapService.removePlaceLocationRectange(location);
          }
        },
        error: (err) => {
          place.plusCodes.push(location.plusCode);
          isPartOfPlace = true;
        },
        complete: () => { }
      });
  }

}
