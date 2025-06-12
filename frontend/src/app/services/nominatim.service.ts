import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { GetNominatimAddressResponse } from '../interfaces/get-nominatim-address-response copy';
import { Location } from '../interfaces/location';
import { NominatimPlace } from '../interfaces/nominatim-place';
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

  getAddressByLocation(location: Location): Observable<GetNominatimAddressResponse> {
    const url = `${environment.apiUrl}/nominatim/countryCode/${location.plusCode}/${location.latitude}/${location.longitude}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: true,
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

  getAddressBySearchTerm(searchTerm: string, limit = 100): Observable<{ sattus: number, result: NominatimPlace[] }> {
    const encodedTerm = encodeURIComponent(searchTerm);
    const url = `${environment.apiUrl}/nominatim/search/${encodedTerm}/${limit}`;

    this.networkService.setNetworkMessageConfig(url, {
      showAlways: true,
      title: 'Searching location',
      image: '',
      icon: '',
      message: `Searching for "${searchTerm}"`,
      button: '',
      delay: 0,
      showSpinner: true
    });

    return this.http.get<{ sattus: number, result: NominatimPlace[] }>(url, this.httpOptions).pipe(
      catchError(this.handleError)
    );
  }

  getAddressBySearchTermWithViewbox(searchTerm: string, latitude: number, longitude: number, limit = 100, boxSize = 5000): Observable<{ sattus: number, result: NominatimPlace[] }> {
    const viewbox = this.calculateViewbox(latitude, longitude, boxSize);
    const encodedTerm = encodeURIComponent(searchTerm);
    const encodedViewbox = encodeURIComponent(viewbox);
    const url = `${environment.apiUrl}/nominatim/noboundedsearch/${encodedTerm}/${limit}/${encodedViewbox}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: true,
      title: 'Searching location',
      image: '',
      icon: '',
      message: `Searching for "${searchTerm}" near your location`,
      button: '',
      delay: 0,
      showSpinner: true
    });

    return this.http.get<{ sattus: number, result: NominatimPlace[] }>(url, this.httpOptions).pipe(
      catchError(this.handleError)
    );
  }

  getAddressBySearchTermWithViewboxAndBounded(searchTerm: string, latitude: number, longitude: number, bounded = 1, limit = 100, boxSize = 5000): Observable<{ sattus: number, result: NominatimPlace[] }> {
    const viewbox = this.calculateViewbox(latitude, longitude, boxSize);
    const encodedTerm = encodeURIComponent(searchTerm);
    const encodedViewbox = encodeURIComponent(viewbox);
    const url = `${environment.apiUrl}/nominatim/boundedsearch/${encodedTerm}/${limit}/${encodedViewbox}`;

    this.networkService.setNetworkMessageConfig(url, {
      showAlways: true,
      title: 'Searching location',
      image: '',
      icon: '',
      message: `Searching for "${searchTerm}" in defined area`,
      button: '',
      delay: 0,
      showSpinner: true
    });

    return this.http.get<{ sattus: number, result: NominatimPlace[] }>(url, this.httpOptions).pipe(
      catchError(this.handleError)
    );
  }

  private calculateViewbox(lat: number, lon: number, radiusMeters: number): string {
    const earthRadius = 6378137; // in Metern (WGS84)

    const deltaLat = (radiusMeters / earthRadius) * (180 / Math.PI);
    const deltaLon = (radiusMeters / (earthRadius * Math.cos(Math.PI * lat / 180))) * (180 / Math.PI);

    const minLat = lat - deltaLat;
    const maxLat = lat + deltaLat;
    const minLon = lon - deltaLon;
    const maxLon = lon + deltaLon;

    return `${minLon},${maxLat},${maxLon},${minLat}`;
  }

  navigateToNominatimPlace(place: NominatimPlace) {
    const address = place.address;

    // Prüfe auf sinnvolle Adressbestandteile
    if (address?.road && (address.house_number || address.postcode || address.city)) {
      const parts = [
        address.road,
        address.house_number,
        address.postcode,
        address.city,
        address.country,
      ].filter(Boolean); // entfernt undefined/null
      const query = encodeURIComponent(parts.join(', '));
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    } else {
      // Fallback: Koordinaten
      window.open(`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lon}`, '_blank');
    }
  }
}
