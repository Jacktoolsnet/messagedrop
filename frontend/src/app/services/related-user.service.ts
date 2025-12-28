import { Injectable } from '@angular/core';
import { RelatedUser } from '../interfaces/related-user';

@Injectable({
  providedIn: 'root'
})
export class RelatedUserService {

  saveUser(relatedUser: RelatedUser): void {
    if (relatedUser.id) {
      localStorage.setItem(relatedUser.id, JSON.stringify(relatedUser));
    }
  }
}
