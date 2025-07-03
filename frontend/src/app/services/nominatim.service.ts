import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { BoundingBox } from '../interfaces/bounding-box';
import { GetNominatimAddressResponse } from '../interfaces/get-nominatim-address-response copy';
import { Location } from '../interfaces/location';
import { NominatimPlace } from '../interfaces/nominatim-place';
import { GeolocationService } from './geolocation.service';
import { NetworkService } from './network.service';

@Injectable({
  providedIn: 'root'
})
export class NominatimService {
  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      'X-API-Authorization': `${environment.apiToken}`,
      withCredentials: 'true'
    })
  };

  constructor(
    private geolocationService: GeolocationService,
    private http: HttpClient,
    private networkService: NetworkService
  ) { }

  private handleError(error: HttpErrorResponse) {
    // Return an observable with a user-facing error message.
    return throwError(() => error);
  }

  getNominatimPlaceByLocation(location: Location, showAlways: boolean = false): Observable<GetNominatimAddressResponse> {
    const url = `${environment.apiUrl}/nominatim/countryCode/${location.plusCode}/${location.latitude}/${location.longitude}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
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

  getNominatimPlaceBySearchTerm(searchTerm: string, limit = 100, showAlways: boolean = false): Observable<{ sattus: number, result: NominatimPlace[] }> {
    const encodedTerm = encodeURIComponent(searchTerm);
    const url = `${environment.apiUrl}/nominatim/search/${encodedTerm}/${limit}`;

    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
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

  getNominatimPlaceBySearchTermWithViewbox(searchTerm: string, latitude: number, longitude: number, limit = 100, boxSize = 5000, showAlways: boolean = false): Observable<{ sattus: number, result: NominatimPlace[] }> {
    const viewbox = this.calculateViewbox(latitude, longitude, boxSize);
    const encodedTerm = encodeURIComponent(searchTerm);
    const encodedViewbox = encodeURIComponent(viewbox);
    const url = `${environment.apiUrl}/nominatim/noboundedsearch/${encodedTerm}/${limit}/${encodedViewbox}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
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

  getBoundingBoxFromNominatimPlace(place: NominatimPlace): BoundingBox {
    let boundingBox: BoundingBox = {
      latMin: 0,
      lonMin: 0,
      latMax: 0,
      lonMax: 0
    };
    if (place.boundingbox && place.boundingbox.length === 4) {
      boundingBox = {
        latMin: parseFloat(place.boundingbox[0]),
        latMax: parseFloat(place.boundingbox[1]),
        lonMin: parseFloat(place.boundingbox[2]),
        lonMax: parseFloat(place.boundingbox[3])
      };
    }
    return boundingBox
  }

  getNominatimPlaceBySearchTermWithViewboxAndBounded(searchTerm: string, latitude: number, longitude: number, bounded = 1, limit = 100, boxSize = 5000, showAlways: boolean = false): Observable<{ sattus: number, result: NominatimPlace[] }> {
    const viewbox = this.calculateViewbox(latitude, longitude, boxSize);
    const encodedTerm = encodeURIComponent(searchTerm);
    const encodedViewbox = encodeURIComponent(viewbox);
    const url = `${environment.apiUrl}/nominatim/boundedsearch/${encodedTerm}/${limit}/${encodedViewbox}`;

    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
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

  getLocationFromNominatimPlace(place: NominatimPlace): Location {
    let location: Location = {
      latitude: place.lat,
      longitude: place.lon,
      plusCode: this.geolocationService.getPlusCode(place.lat, place.lon)
    };
    return location;
  }

  getIconForPlace(nominatimPlace: NominatimPlace): string {
    const type = nominatimPlace.type?.toLowerCase() || '';
    switch (type) {
      case 'zoo':
      case 'animal':
        return 'pets';
      case 'restaurant':
      case 'food':
        return 'restaurant';
      case 'school':
        return 'school';
      case 'park':
        return 'park';
      case 'city':
      case 'town':
      case 'village':
        return 'location_city';
      case 'museum':
        return 'museum';
      case 'hotel':
        return 'hotel';
      case 'station':
      case 'bus_station':
        return 'directions_bus';
      default:
        return 'place';
    }
  }

  getFormattedAddress(place: NominatimPlace, joinWith: string = '\n'): string {
    const address = place.address;
    if (!address) return '';

    const lines: string[] = [];

    const street = [address.road, address.house_number].filter(Boolean).join(' ');
    if (street) lines.push(street);

    const cityLine = [address.postcode, address.city || address.town || address.village].filter(Boolean).join(' ');
    if (cityLine) lines.push(cityLine);

    const suburb = address.suburb;
    if (suburb) lines.push(suburb)

    const country = address.country;
    if (country && !lines.includes(country)) lines.push(country);

    return lines.join(joinWith);
  }

  getFormattedStreet(place: NominatimPlace, joinWith: string = '\n'): string {
    const address = place.address;
    if (!address) return '';

    const lines: string[] = [];

    const street = [address.road, address.house_number].filter(Boolean).join(' ');
    if (street) lines.push(street);

    return lines.join(joinWith);
  }
}
