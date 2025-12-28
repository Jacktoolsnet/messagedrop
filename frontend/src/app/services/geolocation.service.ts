import { Injectable } from '@angular/core';
import OpenLocationCode from 'open-location-code-typescript';
import { Observable } from 'rxjs';
import { BoundingBox } from '../interfaces/bounding-box';
import { Location } from '../interfaces/location';
import { PlusCodeArea } from '../interfaces/plus-code-area';

@Injectable({
  providedIn: 'root'
})
export class GeolocationService {

  private watchID = 0;

  public getPlusCode(latitude: number, longitude: number): string {
    const plusCode = OpenLocationCode.encode(latitude, longitude, 10);
    return plusCode || '';
  }

  public getLocationFromPlusCode(plusCode: string): Location {
    const location: Location = {
      latitude: OpenLocationCode.decode(plusCode)?.latitudeCenter || 0,
      longitude: OpenLocationCode.decode(plusCode)?.longitudeCenter || 0,
      plusCode: plusCode
    };
    return location;
  }

  public getPlusCodeBasedOnMapZoom(location: Location, zoom: number): string {
    let plusCode = '';
    switch (zoom) {
      case 19:
      case 18:
      case 17:
      case 16:
        plusCode = location.plusCode.substring(0, 8);
        break;
      case 15:
      case 14:
      case 13:
      case 12:
      case 11:
        plusCode = location.plusCode.substring(0, 6);
        break;
      case 10:
      case 9:
      case 8:
      case 7:
        plusCode = location.plusCode.substring(0, 4);
        break;
      default:
        plusCode = location.plusCode.substring(0, 2);
        break;
    }
    return plusCode;
  }

  public getGroupedPlusCodeBasedOnMapZoom(location: Location, zoom: number): string {
    let plusCode = '';
    switch (zoom) {
      case 19:
      case 18:
      case 17:
      case 16:
        plusCode = location.plusCode.substring(0, 12);
        break;
      case 15:
      case 14:
      case 13:
      case 12:
      case 11:
        plusCode = location.plusCode.substring(0, 8);
        break;
      case 10:
      case 9:
      case 8:
      case 7:
        plusCode = location.plusCode.substring(0, 6);
        break;
      default:
        plusCode = location.plusCode.substring(0, 4);
        break;
    }
    return plusCode;
  }

  public getCurrentPosition(): Observable<GeolocationPosition> {
    return new Observable<GeolocationPosition>((observer) => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            observer.next(position);
            observer.complete();
          },
          (error) => {
            observer.error(error);
          }
        );
      } else {
        observer.error('Geolocation is not available in this browser.');
      }
    });
  }

  public watchPosition(): Observable<GeolocationPosition> {
    return new Observable<GeolocationPosition>((observer) => {
      if ('geolocation' in navigator) {
        this.watchID = navigator.geolocation.watchPosition(
          (position) => {
            observer.next(position);
          },
          (error) => {
            navigator.geolocation.clearWatch(this.watchID);
            observer.error(error);
          }
        );
      } else {
        observer.error('Geolocation is not available in this browser.');
      }
    });
  }

  public clearWatch(): Observable<void> {
    return new Observable<void>((observer) => {
      if ('geolocation' in navigator) {
        navigator.geolocation.clearWatch(this.watchID);
        observer.complete();
      } else {
        observer.error('Geolocation is not available in this browser.');
      }
    });
  }

  public getGridFromPlusCode(plusCode: string): PlusCodeArea {
    const codeAlphabet = '23456789CFGHJMPQRVWX';
    const latitudeMax = 90;
    const longitudeMax = 180;
    let latitudeLo = 0.0;
    let longitudeLo = 0.0;
    const pairResolutions: number[] = [20.0, 1.0, .05, .0025, .000125];
    let gridSizeDegrees = 0.0;
    let latPlaceValue = 0.0;
    let lngPlaceValue = 0.0;
    let latitudeHi = 0.0;
    let longitudeHi = 0.0;
    let i = 0;

    while (i < plusCode.length) {
      if (plusCode.charAt(i) == '+') {
        i += 1;
      }
      switch (i) {
        case 0:
        case 1:
          gridSizeDegrees = pairResolutions[0];
          break;
        case 2:
        case 3:
          gridSizeDegrees = pairResolutions[1];
          break;
        case 4:
        case 5:
          gridSizeDegrees = pairResolutions[2];
          break;
        case 6:
        case 7:
          gridSizeDegrees = pairResolutions[3];
          break;
        case 8:
        case 9:
        case 10:
          gridSizeDegrees = pairResolutions[4];
          break;
      }
      latPlaceValue = gridSizeDegrees;
      lngPlaceValue = gridSizeDegrees;
      const codeIndexRow: number = codeAlphabet.indexOf(plusCode.charAt(i));
      i += 1;
      const codeIndexColumn: number = codeAlphabet.indexOf(plusCode.charAt(i));
      switch (i) {
        case 1:
          latitudeLo += codeIndexRow * latPlaceValue - 90;
          longitudeLo += codeIndexColumn * lngPlaceValue - 180;
          break;
        default:
          latitudeLo += codeIndexRow * latPlaceValue;
          longitudeLo += codeIndexColumn * lngPlaceValue;
      }
      latitudeHi = latitudeLo + latPlaceValue;
      longitudeHi = longitudeLo + lngPlaceValue;
      i += 1;
    }

    const plusCodeArea: PlusCodeArea = {
      latitudeLo,
      longitudeLo,
      latitudeHi,
      longitudeHi,
      codeLength: plusCode.length,
      latitudeCenter: Math.min(latitudeLo + (latitudeHi - latitudeLo) / 2, latitudeMax),
      longitudeCenter: Math.min(longitudeLo + (longitudeHi - longitudeLo) / 2, longitudeMax)
    };
    return plusCodeArea;
  }

  public getBoundingBoxFromPlusCodes(plusCodes: string[]): BoundingBox {
    if (!plusCodes.length) return {
      latMin: 0,
      lonMin: 0,
      latMax: 0,
      lonMax: 0
    };

    let latMin = Infinity;
    let latMax = -Infinity;
    let lonMin = Infinity;
    let lonMax = -Infinity;

    for (const code of plusCodes) {
      const area = OpenLocationCode.decode(code);
      latMin = Math.min(latMin, area.latitudeLo);
      latMax = Math.max(latMax, area.latitudeHi);
      lonMin = Math.min(lonMin, area.longitudeLo);
      lonMax = Math.max(lonMax, area.longitudeHi);
    }

    return { latMin, latMax, lonMin, lonMax };
  }

  public areLocationsNear(loc1: Location, loc2: Location, maxDistanceMeters = 20): boolean {
    const distance = this.getDistanceInMeters(
      loc1.latitude, loc1.longitude,
      loc2.latitude, loc2.longitude
    );
    return distance <= maxDistanceMeters;
  }

  private getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Radius der Erde in Metern
    const toRad = (deg: number) => deg * Math.PI / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  public getCenterOfBoundingBox(box: BoundingBox): Location {
    const latitude = (box.latMin + box.latMax) / 2;
    const longitude = (box.lonMin + box.lonMax) / 2;
    const plusCode = this.getPlusCode(latitude, longitude); // optional, falls du ihn brauchst

    return {
      latitude,
      longitude,
      plusCode
    };
  }
}
