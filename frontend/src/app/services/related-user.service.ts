import { Injectable } from '@angular/core';
import { RelatedUser } from '../interfaces/related-user';

@Injectable({
  providedIn: 'root'
})
export class RelatedUserService {

  loadUser(userId: string): RelatedUser {
    const storedValue = localStorage.getItem(userId);
    if (!storedValue) {
      return {
        id: '',
        name: 'Unnamed user',
        publicEncryptionKey: undefined,
        publicSigningKey: undefined,
        base64Avatar: ''
      };
    }

    try {
      const parsed = JSON.parse(storedValue) as Partial<RelatedUser>;
      return {
        id: parsed.id ?? '',
        publicEncryptionKey: parsed.publicEncryptionKey,
        publicSigningKey: parsed.publicSigningKey,
        name: parsed.name ?? 'unnamed user',
        base64Avatar: parsed.base64Avatar ?? ''
      };
    } catch {
      return {
        id: '',
        name: 'Unnamed user',
        publicEncryptionKey: undefined,
        publicSigningKey: undefined,
        base64Avatar: ''
      };
    }
  }

  saveUser(relatedUser: RelatedUser): void {
    if (relatedUser.id) {
      localStorage.setItem(relatedUser.id, JSON.stringify(relatedUser));
    }
  }
}
