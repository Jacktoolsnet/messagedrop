import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  SecretDrop,
  SecretDropCreateRequest,
  SecretDropCreateResponse,
  SecretDropDeleteResponse,
  SecretDropListResponse,
  SecretDropStatsResponse
} from '../interfaces/secret-drop';

@Injectable({ providedIn: 'root' })
export class SecretDropService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/secretdrop`;
  readonly mySecretDropsSignal = signal<SecretDrop[]>([]);

  async createSecretDrop(request: SecretDropCreateRequest): Promise<SecretDrop> {
    const response = await firstValueFrom(this.http.post<SecretDropCreateResponse>(`${this.baseUrl}/create`, request));
    const secretDrop = this.normalizeSecretDrop(response.secretDrop);
    this.mySecretDropsSignal.update((drops) => [secretDrop, ...drops.filter((drop) => drop.uuid !== secretDrop.uuid)]);
    return secretDrop;
  }

  async loadMySecretDrops(userId: string): Promise<SecretDrop[]> {
    const response = await firstValueFrom(this.http.get<SecretDropListResponse>(`${this.baseUrl}/my/${encodeURIComponent(userId)}`));
    const rows = (response.rows ?? []).map((row) => this.normalizeSecretDrop(row));
    this.mySecretDropsSignal.set(rows);
    return rows;
  }

  async getStats(uuid: string): Promise<SecretDropStatsResponse> {
    return firstValueFrom(this.http.get<SecretDropStatsResponse>(`${this.baseUrl}/stats/${encodeURIComponent(uuid)}`));
  }

  async deleteSecretDrop(uuid: string): Promise<boolean> {
    const response = await firstValueFrom(this.http.delete<SecretDropDeleteResponse>(`${this.baseUrl}/delete/${encodeURIComponent(uuid)}`));
    if (response.deleted) {
      this.mySecretDropsSignal.update((drops) => drops.filter((drop) => drop.uuid !== uuid));
    }
    return !!response.deleted;
  }

  private normalizeSecretDrop(raw: SecretDrop): SecretDrop {
    const source = raw as SecretDrop & { location?: SecretDrop['location']; latitude?: number; longitude?: number };
    const plusCode = source.plusCode ?? source.location?.plusCode ?? source.discoveryPlusCode ?? '';
    return {
      ...source,
      location: source.location ?? {
        latitude: Number(source.latitude ?? 0),
        longitude: Number(source.longitude ?? 0),
        plusCode
      },
      plusCode,
      discoveryPlusCode: source.discoveryPlusCode ?? plusCode,
      maxUnlocks: source.maxUnlocks === null || source.maxUnlocks === undefined ? null : Number(source.maxUnlocks),
      unlockCount: Number(source.unlockCount ?? 0),
      likes: Number(source.likes ?? 0),
      dislikes: Number(source.dislikes ?? 0),
      commentsNumber: Number(source.commentsNumber ?? 0),
      createdAt: Number(source.createdAt ?? 0),
      validFrom: source.validFrom === null || source.validFrom === undefined ? null : Number(source.validFrom),
      validUntil: source.validUntil === null || source.validUntil === undefined ? null : Number(source.validUntil)
    } as SecretDrop;
  }
}
