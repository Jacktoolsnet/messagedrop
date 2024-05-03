import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Location } from '../interfaces/location';
import * as plusCodes from 'pluscodes';

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

  public getLocationFromPlusCode(plusCode: string): Location{
    plusCode = `${plusCode.substring(0, 8)}+`;
    let location: Location = {
      'latitude' : plusCodes.decode(plusCode)?.latitude || 0,
      'longitude': plusCodes.decode(plusCode)?.longitude  || 0,
      'zoom': 19,
      'plusCode': plusCode
    };
    return location;
  }

  public getPlusCodeBasedOnMapZoom(location: Location): string {
    let plusCode: string = '';
    switch (location.zoom) {
      case 19:
      case 18:
        plusCode = location.plusCode.substring(0, 8);
        break;
      case 17:        
      case 16:
      case 15:
      case 14:
        plusCode = location.plusCode.substring(0, 6);
        break;
      case 13:
      case 12:
      case 11:
        plusCode = location.plusCode.substring(0, 4);
        break;
      default:
        plusCode = location.plusCode.substring(0, 2);
        break;
    }
    return plusCode;
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
}
