import { Injectable } from '@angular/core';
import { RelatedUser } from '../interfaces/related-user';

@Injectable({
  providedIn: 'root'
})
export class RelatedUserService {

  constructor() { }

  loadUser(userId: string): RelatedUser {
    let relatedUserFromLocalStorage: any = JSON.parse(localStorage.getItem(userId) || '{}');
    if (JSON.stringify(relatedUserFromLocalStorage) === '{}') {
      relatedUserFromLocalStorage = {
        id: '',
        name: 'Unnamed user',
        publicEncryptionKey: undefined,
        publicSigningKey: undefined,
        base64Avatar: ''
      }
    } else {
      relatedUserFromLocalStorage = {
        id: undefined != relatedUserFromLocalStorage.id ? relatedUserFromLocalStorage.id : '',
        publicEncryptionKey: undefined != relatedUserFromLocalStorage.publicEncryptionKey ? relatedUserFromLocalStorage.publicEncryptionKey : undefined,
        publicSigningKey: undefined != relatedUserFromLocalStorage.publicSigningKey ? relatedUserFromLocalStorage.publicSigningKey : undefined,
        name: undefined != relatedUserFromLocalStorage.name ? relatedUserFromLocalStorage.name : 'unnamed user',
        base64Avatar: undefined != relatedUserFromLocalStorage.base64Avatar ? relatedUserFromLocalStorage.base64Avatar : ''
      }
    }
    return relatedUserFromLocalStorage;
  }

  saveUser(relatedUser: RelatedUser) {
    if (undefined != relatedUser.id) {
      localStorage.setItem(relatedUser.id, JSON.stringify(relatedUser))
    }
  }
}
