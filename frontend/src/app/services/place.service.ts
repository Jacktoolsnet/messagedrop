import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { DateTime } from 'luxon';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { CreatePlaceResponse } from '../interfaces/create-place-response';
import { Dataset } from '../interfaces/dataset';
import { GetPlaceResponse } from '../interfaces/get-place-response';
import { GetPlacesResponse } from '../interfaces/get-places-response';
import { Location } from '../interfaces/location';
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
    location: {
      latitude: 0,
      longitude: 0,
      plusCode: ''
    },
    base64Avatar: '',
    icon: '',
    subscribed: false,
    boundingBox: {
      latMin: 0,
      lonMin: 0,
      latMax: 0,
      lonMax: 0
    },
    timezone: '',
    datasets: {
      weatherDataset: {
        data: undefined,
        lastUpdate: undefined
      },
      airQualityDataset: {
        data: undefined,
        lastUpdate: undefined
      }
    }
  };
  private ready: boolean = false;

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      'X-API-Authorization': `${environment.apiToken}`,
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
      location: {
        latitude: 0,
        longitude: 0,
        plusCode: ''
      },
      base64Avatar: '',
      icon: '',
      subscribed: false,
      boundingBox: {
        latMin: 0,
        lonMin: 0,
        latMax: 0,
        lonMax: 0
      },
      timezone: '',
      datasets: {
        weatherDataset: {
          data: undefined,
          lastUpdate: undefined
        },
        airQualityDataset: {
          data: undefined,
          lastUpdate: undefined
        }
      }
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

  setSelectedPlace(place: Place) {
    this.selectedPlace = place;
  }

  unselectPlace() {
    this.selectedPlace = {
      id: '',
      userId: '',
      name: '',
      location: {
        latitude: 0,
        longitude: 0,
        plusCode: ''
      },
      base64Avatar: '',
      icon: '',
      subscribed: false,
      boundingBox: {
        latMin: 0,
        lonMin: 0,
        latMax: 0,
        lonMax: 0
      },
      timezone: '',
      datasets: {
        weatherDataset: {
          data: undefined,
          lastUpdate: undefined
        },
        airQualityDataset: {
          data: undefined,
          lastUpdate: undefined
        }
      }
    };;
  }

  isReady(): boolean {
    return this.ready;
  }

  createPlace(place: Place, showAlways: boolean = false) {
    let url = `${environment.apiUrl}/place/create`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
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

  updatePlace(place: Place, showAlways: boolean = false) {
    let url = `${environment.apiUrl}/place/update`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
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

  getByUserId(userId: string, showAlways: boolean = false) {
    let url = `${environment.apiUrl}/place/get/userId/${userId}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
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

  getById(placeId: string, showAlways: boolean = false) {
    let url = `${environment.apiUrl}/place/get/${placeId}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
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

  getByUserIdAndName(userId: string, name: string, showAlways: boolean = false) {
    let url = `${environment.apiUrl}/place/get/userId/${userId}/name/${name}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
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

  deletePlace(placeId: string, showAlways: boolean = false) {
    let url = `${environment.apiUrl}/place/delete/${placeId}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
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

  subscribe(place: Place, showAlways: boolean = false) {
    let url = `${environment.apiUrl}/place/subscribe/${place.id}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
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

  unsubscribe(place: Place, showAlways: boolean = false) {
    let url = `${environment.apiUrl}/place/unsubscribe/${place.id}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
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

  getTimezone(location: Location, showAlways: boolean = false) {
    let url = `${environment.apiUrl}/place/timezone/${location.latitude}/${location.longitude}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
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

  getFormattedTime(timezone: string, locale: string): string {
    return DateTime.now().setZone(timezone).setLocale(locale).toFormat('HH:mm:ss');
  }

  getFormattedDate(timezone: string, locale: string): string {
    return DateTime.now().setZone(timezone).setLocale(locale).toFormat('cccc, dd LLL yyyy');
  }

  getWeekNumber(timezone: string, locale: string): string {
    const dt = DateTime.now().setZone(timezone).setLocale(locale);
    const weekNumber = dt.weekNumber;

    // Lokalisierte Präfixe
    const prefix = locale.startsWith('de') ? 'KW' : 'Wk';
    return `${prefix} ${weekNumber}`;
  }

  isDatasetExpired(dataset: Dataset<any> | undefined, expirationInMinutes = 60): boolean {
    if (!dataset?.lastUpdate) return true;

    const last = typeof dataset.lastUpdate === 'string'
      ? DateTime.fromISO(dataset.lastUpdate)
      : dataset.lastUpdate;

    return last.plus({ minutes: expirationInMinutes }) < DateTime.now();
  }
}
