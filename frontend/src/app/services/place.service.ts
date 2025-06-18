import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { CreatePlaceResponse } from '../interfaces/create-place-response';
import { GetPlaceResponse } from '../interfaces/get-place-response';
import { GetPlacesResponse } from '../interfaces/get-places-response';
import { Place } from '../interfaces/place';
import { SimpleStatusResponse } from '../interfaces/simple-status-response';
import { IndexedDbService } from './indexed-db.service';
import { NetworkService } from './network.service';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root'
})
export class PlaceService {

  private places: Place[] = [];
  private selectedPlace: Place = {
    id: '',
    userId: '',
    name: '',
    base64Avatar: '',
    icon: '',
    subscribed: false,
    boundingBox: undefined,
    plusCodes: []
  };
  private ready: boolean = false;

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${environment.apiToken}`,
      withCredentials: 'true'
    })
  };

  constructor(
    private userService: UserService,
    private indexedDbService: IndexedDbService,
    private networkService: NetworkService,
    private http: HttpClient) {
  }

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  initPlaces() {
    this.getByUserId(this.userService.getUser().id)
      .subscribe({
        next: (getPlacesResponse: GetPlacesResponse) => {
          getPlacesResponse.rows.forEach((row) => {
            this.loadPlaceFromIndexedDb(row.id);
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

  public logout() {
    this.places = [];
    this.selectedPlace = {
      id: '',
      userId: '',
      name: '',
      base64Avatar: '',
      icon: '',
      subscribed: false,
      boundingBox: undefined,
      plusCodes: []
    };
    this.ready = false;
  }

  private async loadPlaceFromIndexedDb(placeId: string) {
    const placeFromIndexedDb = await this.indexedDbService.getPlace(placeId);
    if (placeFromIndexedDb) {
      this.places.push(placeFromIndexedDb);
    } else {
      this.deletePlace(placeId)
        .subscribe({
          next: (simpleStatusResponse) => { },
          error: (err) => {
          },
          complete: () => { }
        });
    }
  }

  saveAdditionalPlaceInfos() {
    this.places.forEach((place: Place) => {
      this.indexedDbService.setPlaceProfile(place.id, place)
    })
  }

  getPlaces(): Place[] {
    return this.places;
  }

  getSelectedPlace(): Place {
    return this.selectedPlace;
  }

  unselectPlace() {
    this.selectedPlace = {
      id: '',
      userId: '',
      name: '',
      base64Avatar: '',
      icon: '',
      subscribed: false,
      boundingBox: undefined,
      plusCodes: []
    };;
  }

  isReady(): boolean {
    return this.ready;
  }

  createPlace(place: Place) {
    let url = `${environment.apiUrl}/place/create`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: false,
      title: 'Place service',
      image: '',
      icon: '',
      message: `Creating place`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    let body = {
      'userId': place.userId,
      'name': place.name,
      'latMin': place.boundingBox?.latMin,
      'latMax': place.boundingBox?.latMax,
      'lonMin': place.boundingBox?.lonMin,
      'lonMax': place.boundingBox?.lonMax
    };
    return this.http.post<CreatePlaceResponse>(url, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  updatePlace(place: Place) {
    let url = `${environment.apiUrl}/place/update`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: false,
      title: 'Place service',
      image: '',
      icon: '',
      message: `Updating place`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    let body = {
      'id': place.id,
      'name': place.name,
      'latMin': place.boundingBox?.latMin,
      'latMax': place.boundingBox?.latMax,
      'lonMin': place.boundingBox?.lonMin,
      'lonMax': place.boundingBox?.lonMax
    };
    return this.http.post<SimpleStatusResponse>(url, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  getByUserId(userId: string) {
    let url = `${environment.apiUrl}/place/get/userId/${userId}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: false,
      title: 'Place service',
      image: '',
      icon: '',
      message: `Loading places`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    return this.http.get<GetPlacesResponse>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  getById(placeId: string) {
    let url = `${environment.apiUrl}/place/get/${placeId}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: false,
      title: 'Place service',
      image: '',
      icon: '',
      message: `Loading place`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    return this.http.get<GetPlaceResponse>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  getByUserIdAndName(userId: string, name: string) {
    let url = `${environment.apiUrl}/place/get/userId/${userId}/name/${name}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: false,
      title: 'Place service',
      image: '',
      icon: '',
      message: `Loading places`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    return this.http.get<GetPlaceResponse>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  deletePlace(placeId: string) {
    let url = `${environment.apiUrl}/place/delete/${placeId}`;
    console.log(url);
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: false,
      title: 'Place service',
      image: '',
      icon: '',
      message: `Deleting place`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    return this.http.get<SimpleStatusResponse>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  subscribe(place: Place) {
    let url = `${environment.apiUrl}/place/subscribe/${place.id}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: false,
      title: 'Place service',
      image: '',
      icon: '',
      message: `Subscribe to place`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    return this.http.get<SimpleStatusResponse>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  unsubscribe(place: Place) {
    let url = `${environment.apiUrl}/place/unsubscribe/${place.id}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: false,
      title: 'Place service',
      image: '',
      icon: '',
      message: `Unsubscribe from place`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    return this.http.get<SimpleStatusResponse>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }
}
