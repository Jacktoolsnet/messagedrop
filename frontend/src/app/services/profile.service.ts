import { Injectable } from '@angular/core';
import { Profile } from '../interfaces/profile';
import { IndexedDbService } from './indexed-db.service';

@Injectable({
  providedIn: 'root'
})
export class ProfileService {

  private profiles = new Map<string, Profile>();

  constructor(
    private indexedDbService: IndexedDbService
  ) { }

  async loadAllProfiles(): Promise<void> {
    this.profiles = await this.indexedDbService.getAllProfilesAsMap();
  }

  setProfile(userId: string, profile: Profile) {
    this.profiles.set(userId, profile);
    this.indexedDbService.setProfile(userId, profile)
  }

  getProfile(userId: string): Profile | undefined {
    return this.profiles.get(userId);
  }

  deleteProfile(userId: string): void {
    this.profiles.delete(userId);
    this.indexedDbService.deleteProfile(userId)
  }
}
