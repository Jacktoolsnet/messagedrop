import { Injectable } from '@angular/core';
import OpenLocationCode from 'open-location-code-typescript';
import { Observable } from 'rxjs';
import { BoundingBox } from '../interfaces/bounding-box';
import { Location } from '../interfaces/location';
import { Message } from '../interfaces/message';
import { PlusCodeArea } from '../interfaces/plus-code-area';

@Injectable({
  providedIn: 'root'
})
export class GeolocationService {

  private watchID: number = 0;

  constructor() { }

  public getPlusCode(latitude: number, longitude: number): string {
    let plusCode = OpenLocationCode.encode(latitude, longitude, 10);
    return plusCode || '';
  }

  public getLocationFromMessage(message: Message): Location {
    let location: Location = {
      latitude: message.latitude || 0,
      longitude: message.longitude || 0,
      plusCode: message.plusCode || ''
    };
    return location;
  }

  public getLocationFromPlusCode(plusCode: string): Location {
    let location: Location = {
      latitude: OpenLocationCode.decode(plusCode)?.latitudeCenter || 0,
      longitude: OpenLocationCode.decode(plusCode)?.longitudeCenter || 0,
      plusCode: plusCode
    };
    return location;
  }

  public getPlusCodeBasedOnMapZoom(location: Location, zoom: number): string {
    let plusCode: string = '';
    switch (zoom) {
      case 19:
      case 18:
        plusCode = location.plusCode;
        break;
      case 17:
      case 16:
      case 15:
      case 14:
        plusCode = location.plusCode.substring(0, 8);
        break;
      case 13:
      case 12:
      case 11:
      case 10:
        plusCode = location.plusCode.substring(0, 6);
        break;
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

  public getGroupedPlusCodeLengthBasedOnMapZoom(location: Location, zoom: number): number {
    let plusCodeLength: number = 11;
    switch (zoom) {
      case 19:
      case 18:
      case 17:
      case 16:
      case 15:
      case 14:
        plusCodeLength = 8;
        break;
      case 13:
      case 12:
      case 11:
      case 10:
        plusCodeLength = 6;
        break;
      case 9:
      case 8:
      case 7:
        plusCodeLength = 4;
        break;
      default:
        plusCodeLength = 2;
        break;
    }
    return plusCodeLength;
  }

  public getCurrentPosition(): Observable<any> {
    return new Observable((observer) => {
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

  public watchPosition(): Observable<any> {
    return new Observable((observer) => {
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

  public clearWatch(): Observable<any> {
    return new Observable((observer) => {
      if ('geolocation' in navigator) {
        navigator.geolocation.clearWatch(this.watchID);
        observer.complete();
      } else {
        observer.error('Geolocation is not available in this browser.');
      }
    });
  }

  public getGridFromPlusCode(plusCode: string): PlusCodeArea {
    let codeAlphabet: string = '23456789CFGHJMPQRVWX';
    let latitudeMax: number = 90;
    let longitudeMax: number = 180;
    let gridRows: number = 9;
    let gridColumns: number = 18;
    let latitudeLo: number = 0.0;
    let longitudeLo: number = 0.0;
    let pairResolutions: number[] = [20.0, 1.0, .05, .0025, .000125];
    let gridSizeDegrees: number = 0.0;
    let latPlaceValue: number = 0.0;
    let lngPlaceValue: number = 0.0;
    let latitudeHi: number = 0.0;
    let longitudeHi: number = 0.0;
    let i: number = 0;

    while (i < plusCode.length) {
      if (plusCode.charAt(i) == '+') {
        i += 1;
      }
      switch (i) {
        case 0:
        case 1:
          gridSizeDegrees = pairResolutions[0];
          gridRows = 9;
          gridColumns = 18;
          break;
        case 2:
        case 3:
          gridSizeDegrees = pairResolutions[1];
          gridRows = 20;
          gridColumns = 20;
          break;
        case 4:
        case 5:
          gridSizeDegrees = pairResolutions[2];
          gridRows = 20;
          gridColumns = 20;
          break;
        case 6:
        case 7:
          gridSizeDegrees = pairResolutions[3];
          gridRows = 20;
          gridColumns = 20;
          break;
        case 8:
        case 9:
        case 10:
          gridSizeDegrees = pairResolutions[4];
          gridRows = 20;
          gridColumns = 20;
          break;
      }
      latPlaceValue = gridSizeDegrees;
      lngPlaceValue = gridSizeDegrees;
      let codeIndexRow: number = codeAlphabet.indexOf(plusCode.charAt(i));
      i += 1;
      let codeIndexColumn: number = codeAlphabet.indexOf(plusCode.charAt(i));
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

    let plusCodeArea: PlusCodeArea = {
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

  public getGridFromCompletePlusCode(plusCode: string): PlusCodeArea {
    const decoded = OpenLocationCode.decode(plusCode);
    return {
      latitudeLo: decoded.latitudeLo,
      longitudeLo: decoded.longitudeLo,
      latitudeHi: decoded.latitudeHi,
      longitudeHi: decoded.longitudeHi,
      codeLength: plusCode.length,
      latitudeCenter: decoded.latitudeCenter,
      longitudeCenter: decoded.longitudeCenter
    };
  }

  public getBoundingBoxFromPlusCodes(plusCodes: string[]): BoundingBox | undefined {
    if (!plusCodes.length) return undefined;

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

  public getPlusCodesInBoundingBox(box: BoundingBox, codeLength: number = 10): string[] {
    const resolutionMap: Record<number, number> = {
      10: 0.000125,
      8: 0.0025,
      6: 0.05,
      4: 1.0
    };

    const step = resolutionMap[codeLength] || 0.000125;
    const result: Set<string> = new Set();

    for (let lat = box.latMin; lat <= box.latMax; lat += step) {
      for (let lon = box.lonMin; lon <= box.lonMax; lon += step) {
        result.add(OpenLocationCode.encode(lat, lon, codeLength));
      }
    }
    return Array.from(result);
  }

  public getPlusCodesByZoom(box: BoundingBox, zoom: number): string[] {
    let codeLength = 10;
    if (zoom <= 14) codeLength = 8;
    if (zoom <= 10) codeLength = 6;
    if (zoom <= 7) codeLength = 4;

    return this.getPlusCodesInBoundingBox(box, codeLength);
  }

  public areLocationsNear(loc1: Location, loc2: Location, maxDistanceMeters: number = 20): boolean {
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
