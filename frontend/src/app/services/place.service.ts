import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { computed, Injectable, inject, signal } from '@angular/core';
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

  private _places = signal<Place[]>([]);
  private _selectedPlace = signal<Place | null>(null);
  private ready = false;

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      'X-API-Authorization': `${environment.apiToken}`,
      withCredentials: 'true'
    })
  };

  private readonly userService = inject(UserService);
  private readonly indexedDbService = inject(IndexedDbService);
  private readonly networkService = inject(NetworkService);
  private readonly http = inject(HttpClient);

  get getPlaces() { return this._places.asReadonly(); }
  get selectedPlace() { return this._selectedPlace.asReadonly(); }

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  initPlaces() {
    this.getByUserId(this.userService.getUser().id).subscribe({
      next: async (response) => {
        const places = await Promise.all(response.rows.map(row => this.loadPlaceFromIndexedDb(row.id)));
        this._places.set(places as Place[]);
        this.ready = true;
      },
      error: (err) => {
        console.error('Failed to load places', err);
        this._places.set([]);
        this.ready = true;
      }
    });
  }

  logout() {
    this._places.set([]);
    this._selectedPlace.set(null);
    this.ready = false;
  }

  private async loadPlaceFromIndexedDb(placeId: string): Promise<Place | null> {
    const place = await this.indexedDbService.getPlace(placeId);
    if (!place) {
      this.deletePlace(placeId).subscribe();
    }
    return place ?? null;
  }

  readonly sortedPlacesSignal = computed(() =>
    this.getPlaces().slice().sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      }

      const nameCompare = a.name.localeCompare(b.name);
      if (nameCompare !== 0) {
        return nameCompare;
      }

      return a.id.localeCompare(b.id);
    })
  );

  setPlaces(places: Place[]) {
    this._places.set(places);
  }

  setSelectedPlace(place: Place) {
    this._selectedPlace.set(place);
  }

  async saveAdditionalPlaceInfos(place: Place) {
    // Aktuelles Array holen
    const places = this._places();

    // Neuen Place einfügen (du kannst hier noch prüfen, ob er schon existiert)
    const updatedPlaces = [...places.filter(p => p.id !== place.id), place];

    // Signal updaten
    this._places.set(updatedPlaces);

    // Alle Places in die IndexedDB schreiben
    await Promise.all(updatedPlaces.map(p => this.indexedDbService.setPlaceProfile(p.id, p)));
  }

  isReady(): boolean {
    return this.ready;
  }

  createPlace(place: Place, showAlways = false) {
    const url = `${environment.apiUrl}/place/create`;
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
    const body = {
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

  updatePlace(place: Place, showAlways = false) {
    const url = `${environment.apiUrl}/place/update`;
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
    const body = {
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

  getByUserId(userId: string, showAlways = false) {
    const url = `${environment.apiUrl}/place/get/userId/${userId}`;
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

  getById(placeId: string, showAlways = false) {
    const url = `${environment.apiUrl}/place/get/${placeId}`;
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

  getByUserIdAndName(userId: string, name: string, showAlways = false) {
    const url = `${environment.apiUrl}/place/get/userId/${userId}/name/${name}`;
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

  deletePlace(placeId: string, showAlways = false) {
    const url = `${environment.apiUrl}/place/delete/${placeId}`;
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

  removePlace(placeId: string): void {
    const updatedPlaces = this._places().filter(place => place.id !== placeId);
    this._places.set(updatedPlaces);
    this.indexedDbService.deletePlace(placeId).catch(err => {
      console.error('Failed to delete place locally', err);
    });
  }

  subscribe(place: Place, showAlways = false) {
    const url = `${environment.apiUrl}/place/subscribe/${place.id}`;
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

  unsubscribe(place: Place, showAlways = false) {
    const url = `${environment.apiUrl}/place/unsubscribe/${place.id}`;
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

  getTimezone(location: Location, showAlways = false) {
    const url = `${environment.apiUrl}/place/timezone/${location.latitude}/${location.longitude}`;
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

  isDatasetExpired<T>(dataset: Dataset<T> | undefined, expirationInMinutes = 60): boolean {
    if (!dataset?.lastUpdate) return true;

    const last = typeof dataset.lastUpdate === 'string'
      ? DateTime.fromISO(dataset.lastUpdate)
      : dataset.lastUpdate;

    return last.plus({ minutes: expirationInMinutes }) < DateTime.now();
  }
}
