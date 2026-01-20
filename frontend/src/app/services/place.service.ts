import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
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
import { normalizeTileSettings } from '../interfaces/tile-settings';
import { AvatarStorageService } from './avatar-storage.service';
import { IndexedDbService } from './indexed-db.service';
import { NetworkService } from './network.service';
import { TranslationHelperService } from './translation-helper.service';
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
      withCredentials: 'true'
    })
  };

  private readonly userService = inject(UserService);
  private readonly indexedDbService = inject(IndexedDbService);
  private readonly networkService = inject(NetworkService);
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(TranslationHelperService);
  private readonly avatarStorage = inject(AvatarStorageService);

  get getPlaces() { return this._places.asReadonly(); }
  get selectedPlace() { return this._selectedPlace.asReadonly(); }

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  initPlaces() {
    const userId = this.userService.getUser().id;
    if (!this.userService.isReady() || !userId) {
      this.ready = false;
      return;
    }
    if (!this.userService.hasJwt()) {
      void this.loadCachedPlaces();
      return;
    }
    this.getByUserId(userId).subscribe({
      next: async (response) => {
        const places = await Promise.all((response.rows ?? []).map(row => this.loadPlaceFromIndexedDb(row.id)));
        this._places.set(places as Place[]);
        this.ready = true;
      },
      error: (err) => {
        console.error('Failed to load places', err);
        void this.loadCachedPlaces();
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
    const tileSettings = await this.indexedDbService.getTileSettings(placeId);
    if (!place) {
      if (this.userService.hasJwt()) {
        this.deletePlace(placeId).subscribe();
      }
    }
    if (!place) {
      return null;
    }

    if (this.avatarStorage.isSupported()) {
      place.base64Avatar = place.avatarFileId
        ? (await this.avatarStorage.getImageUrl(place.avatarFileId)) || ''
        : '';
      place.placeBackgroundImage = place.placeBackgroundFileId
        ? (await this.avatarStorage.getImageUrl(place.placeBackgroundFileId)) || ''
        : '';
    } else {
      place.base64Avatar = '';
      place.placeBackgroundImage = '';
    }

    const mergedPlace: Place = tileSettings ? { ...place, tileSettings } : place;
    return this.normalizePlaceTileSettings(mergedPlace);
  }

  private async loadCachedPlaces(): Promise<void> {
    try {
      const cached = await this.indexedDbService.getAllPlaces();
      const places = await Promise.all(cached.map(place => this.loadPlaceFromIndexedDb(place.id)));
      this._places.set(places.filter((place): place is Place => Boolean(place)));
      this.ready = true;
    } catch (err) {
      console.error('Failed to load cached places', err);
      this._places.set([]);
      this.ready = false;
    }
  }

  private normalizePlaceTileSettings(place: Place): Place {
    return {
      ...place,
      tileSettings: normalizeTileSettings(place.tileSettings)
    };
  }

  readonly sortedPlacesSignal = computed(() =>
    this.getPlaces().slice().sort((a, b) => {
      const orderA = a.sortOrder ?? Number.POSITIVE_INFINITY;
      const orderB = b.sortOrder ?? Number.POSITIVE_INFINITY;
      if (orderA !== orderB) {
        return orderA - orderB;
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

  getNextSortOrder(): number {
    const orders = this._places().map(place => place.sortOrder).filter((order): order is number => typeof order === 'number');
    if (!orders.length) {
      return this._places().length;
    }
    return Math.max(...orders) + 1;
  }

  async updatePlaceOrder(orderedIds: string[]): Promise<void> {
    const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
    const fallbackStart = orderedIds.length;
    let fallbackIndex = 0;

    const updated = this._places().map((place) => {
      const order = orderMap.get(place.id);
      if (order === undefined) {
        const value = fallbackStart + fallbackIndex;
        fallbackIndex += 1;
        return { ...place, sortOrder: value };
      }
      return { ...place, sortOrder: order };
    }).map(place => this.normalizePlaceTileSettings(place));

    this._places.set(updated);

    await Promise.all(updated.map(async (place) => {
      await this.indexedDbService.setPlaceProfile(place.id, place);
      await this.indexedDbService.setTileSettings(place.id, place.tileSettings ?? []);
    }));
  }

  async saveAdditionalPlaceInfos(place: Place) {
    const normalizedPlace = this.normalizePlaceTileSettings(place);
    const places = this._places();

    const updatedPlaces = [...places.filter(p => p.id !== place.id).map(p => this.normalizePlaceTileSettings(p)), normalizedPlace];

    this._places.set(updatedPlaces);

    await Promise.all(updatedPlaces.map(async p => {
      await this.indexedDbService.setPlaceProfile(p.id, p);
      await this.indexedDbService.setTileSettings(p.id, p.tileSettings ?? []);
    }));
  }

  isReady(): boolean {
    return this.ready;
  }

  createPlace(place: Place, showAlways = false) {
    const url = `${environment.apiUrl}/place/create`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: this.i18n.t('common.place.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.place.creating'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
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
      title: this.i18n.t('common.place.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.place.updating'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
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
      title: this.i18n.t('common.place.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.place.loadingList'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
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
      title: this.i18n.t('common.place.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.place.loadingSingle'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
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
      title: this.i18n.t('common.place.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.place.deleting'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
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
    this.indexedDbService.deleteTileSettings(placeId).catch(err => {
      console.error('Failed to delete tile settings locally', err);
    });
  }

  subscribe(place: Place, showAlways = false) {
    const url = `${environment.apiUrl}/place/subscribe/${place.id}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: this.i18n.t('common.place.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.place.subscribing'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
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
      title: this.i18n.t('common.place.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.place.unsubscribing'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
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
      title: this.i18n.t('common.place.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.place.loadingTimezone'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
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
