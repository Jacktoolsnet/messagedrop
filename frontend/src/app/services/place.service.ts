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
import { IndexedDbService } from './indexed-db.service';
import { MapService } from './map.service';
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
    subscribed: false,
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
              name: '',
              base64Avatar: '',
              subscribed: row.subscribed,
              plusCodes: plusCodes
            });
          });
          this.updatePlaceProfile();
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

  private updatePlaceProfile() {
    this.places.forEach(async (place: Place) => {
      let placeProfile = await this.indexedDbService.getPlaceProfile(place.id);
      place.name = undefined != placeProfile ? placeProfile.name : '';
      place.base64Avatar = undefined != placeProfile ? placeProfile.base64Avatar : '';
    });
  }

  saveAdditionalPlaceInfos() {
    this.places.forEach((place: Place) => {
      this.indexedDbService.setPlaceProfile(place.id, { name: place.name, base64Avatar: place.base64Avatar })
    })
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
    let url = `${environment.apiUrl}/place/create`;
    this.networkService.setNetworkMessageConfig(url, {
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
    };
    return this.http.post<CreatePlaceResponse>(url, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  updatePlace(place: Place) {
    let url = `${environment.apiUrl}/place/update`;
    this.networkService.setNetworkMessageConfig(url, {
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
      'name': place.name
    };
    return this.http.post<SimpleStatusResponse>(url, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  getByUserId(userId: string) {
    let url = `${environment.apiUrl}/place/get/userId/${userId}`;
    this.networkService.setNetworkMessageConfig(url, {
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

  deletePlace(place: Place) {
    let url = `${environment.apiUrl}/place/delete/${place.id}`;
    this.networkService.setNetworkMessageConfig(url, {
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

  addPlusCodeToPlace(place: Place, location: Location, isPartOfPlace: boolean, mapService: MapService) {
    place.plusCodes.push(location.plusCode);
    let url = `${environment.apiUrl}/place/updatepluscodes`;
    this.networkService.setNetworkMessageConfig(url, {
      title: 'Place service',
      image: '',
      icon: '',
      message: `Adding pluscode from place`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    let body = {
      'id': place.id,
      'pluscodes': JSON.stringify(place.plusCodes)
    };
    this.http.post<SimpleStatusResponse>(url, body, this.httpOptions)
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
    let url = `${environment.apiUrl}/place/updatepluscodes`;
    this.networkService.setNetworkMessageConfig(url, {
      title: 'Place service',
      image: '',
      icon: '',
      message: `Removing pluscode from place`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    let body = {
      'id': place.id,
      'pluscodes': JSON.stringify(place.plusCodes)
    };
    this.http.post<SimpleStatusResponse>(url, body, this.httpOptions)
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
