import { Injectable, inject } from '@angular/core';
import { Profile } from '../interfaces/profile';
import { AvatarStorageService } from './avatar-storage.service';
import { IndexedDbService } from './indexed-db.service';

@Injectable({
  providedIn: 'root'
})
export class ProfileService {

  private profiles = new Map<string, Profile>();

  private readonly indexedDbService = inject(IndexedDbService);
  private readonly avatarStorage = inject(AvatarStorageService);

  async loadAllProfiles(): Promise<void> {
    this.profiles = await this.indexedDbService.getAllProfilesAsMap();
    if (!this.avatarStorage.isSupported()) {
      this.profiles.forEach((profile) => {
        profile.base64Avatar = '';
      });
      return;
    }
    await Promise.all(Array.from(this.profiles.values()).map(async (profile) => {
      profile.base64Avatar = profile.avatarFileId
        ? (await this.avatarStorage.getImageUrl(profile.avatarFileId)) || ''
        : '';
    }));
  }

  setProfile(userId: string, profile: Profile) {
    this.profiles.set(userId, profile);
    this.indexedDbService.setProfile(userId, profile);
  }

  getProfile(userId: string): Profile | undefined {
    return this.profiles.get(userId);
  }

  deleteProfile(userId: string): void {
    this.profiles.delete(userId);
    this.indexedDbService.deleteProfile(userId);
}
}
