import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NetworkService {

  constructor() { }

  online: boolean = true;

  init(networkOnline: Subject<void>, networkOffline: Subject<void>) {
    window.addEventListener('online', () => {
      this.online = true;
      networkOnline.next();
    });
    window.addEventListener('offline', () => {
      this.online = false;
      networkOffline.next();
    });
  }

  isOnline(): boolean {
    return this.online;
  }

}
