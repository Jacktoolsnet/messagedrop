import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Location } from '../interfaces/location';
import * as plusCodes from 'pluscodes';
import { Message } from '../interfaces/message';
import { PlusCodeArea } from '../interfaces/plus-code-area';

@Injectable({
  providedIn: 'root'
})
export class GeolocationService {

  private watchID: number = 0;

  constructor() { }

  public getPlusCode(latitude: number, longitude: number): string {
    let plusCode = plusCodes.encode({latitude, longitude});
    if (null === plusCode) {
      return '';
    } else {
      return plusCode;
    }
  }

  public getLocationFromMessage(message: Message): Location {
    let location: Location = {
      latitude : message.latitude || 0,
      longitude: message.longitude  || 0,
      zoom: 19,
      plusCode: message.plusCode || ''
    };
    return location;
  }

  public getLocationFromPlusCode(plusCode: string, plusCodeLength: number): Location{
    let plusCodeComplete: string = plusCodeLength === 11 ? `${plusCode.substring(0, plusCodeLength)}` : `${plusCode.substring(0, plusCodeLength)}+`;
    plusCode = plusCode.substring(0, plusCodeLength);
    let location: Location = {
      latitude : plusCodes.decode(plusCodeComplete)?.latitude || 0,
      longitude: plusCodes.decode(plusCodeComplete)?.longitude  || 0,
      zoom: 19,
      plusCode: plusCode
    };
    return location;
  }

  public getPlusCodeBasedOnMapZoom(location: Location): string {
    let plusCode: string = '';
    switch (location.zoom) {
      case 19:
      case 18:
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

  public getGroupedPlusCodeLengthBasedOnMapZoom(location: Location): number {
    let plusCodeLength: number = 11;
    switch (location.zoom) {
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
}
