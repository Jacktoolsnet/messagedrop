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
  SecretDropStatsResponse,
  SecretDropUpdateResponse
} from '../interfaces/secret-drop';
import { IndexedDbService } from './indexed-db.service';

@Injectable({ providedIn: 'root' })
export class SecretDropService {
  private readonly http = inject(HttpClient);
  private readonly indexedDb = inject(IndexedDbService);
  private readonly baseUrl = `${environment.apiUrl}/secretdrop`;
  readonly mySecretDropsSignal = signal<SecretDrop[]>([]);

  async createSecretDrop(request: SecretDropCreateRequest, localPlainData?: Partial<SecretDrop>): Promise<SecretDrop> {
    const response = await firstValueFrom(this.http.post<SecretDropCreateResponse>(`${this.baseUrl}/create`, request));
    const secretDrop = this.normalizeSecretDrop({
      ...response.secretDrop,
      ...localPlainData,
      publishState: 'published',
      localOnly: false
    });
    this.mySecretDropsSignal.update((drops) => [secretDrop, ...drops.filter((drop) => drop.uuid !== secretDrop.uuid)]);
    await this.saveOwnSecretDrops(request.userId, this.mySecretDropsSignal());
    return secretDrop;
  }

  async loadMySecretDrops(userId: string): Promise<SecretDrop[]> {
    const localRows = await this.loadOwnSecretDrops(userId);
    const response = await firstValueFrom(this.http.get<SecretDropListResponse>(`${this.baseUrl}/my/${encodeURIComponent(userId)}`));
    const localByUuid = new Map(localRows.map((drop) => [drop.uuid, drop]));
    const serverRows = (response.rows ?? []).map((row) => {
      const local = localByUuid.get(row.uuid);
      return this.normalizeSecretDrop({
        ...row,
        message: local?.message,
        messageStyle: local?.messageStyle,
        multimedia: local?.multimedia,
        publishState: row.status === 'enabled' ? 'published' : 'unpublished',
        localOnly: false
      });
    });
    const serverUuids = new Set(serverRows.map((drop) => drop.uuid));
    const localOnlyRows = localRows.filter((drop) => drop.localOnly || !serverUuids.has(drop.uuid));
    const rows = [...localOnlyRows, ...serverRows].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    this.mySecretDropsSignal.set(rows);
    await this.saveOwnSecretDrops(userId, rows);
    return rows;
  }

  async loadOwnSecretDrops(userId: string): Promise<SecretDrop[]> {
    if (!userId) {
      return [];
    }
    const rows = await this.indexedDb.getOwnSecretDrops(userId);
    return (rows ?? []).map((row) => this.normalizeSecretDrop(row));
  }

  async saveOwnSecretDrops(userId: string, drops: SecretDrop[]): Promise<void> {
    if (!userId) {
      return;
    }
    await this.indexedDb.setOwnSecretDrops(userId, (drops ?? []).map((drop) => this.normalizeSecretDrop(drop)));
  }

  async saveDraftSecretDrop(userId: string, drop: SecretDrop): Promise<SecretDrop> {
    const draft = this.normalizeSecretDrop({
      ...drop,
      userId,
      status: 'disabled',
      publishState: 'draft',
      localOnly: true,
      createdAt: drop.createdAt || Math.floor(Date.now() / 1000)
    });
    this.mySecretDropsSignal.update((drops) => [draft, ...drops.filter((entry) => entry.uuid !== draft.uuid)]);
    await this.saveOwnSecretDrops(userId, this.mySecretDropsSignal());
    return draft;
  }

  async removeLocalSecretDrop(userId: string, uuid: string): Promise<void> {
    this.mySecretDropsSignal.update((drops) => drops.filter((drop) => drop.uuid !== uuid));
    await this.saveOwnSecretDrops(userId, this.mySecretDropsSignal());
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

  async publishSecretDrop(uuid: string): Promise<SecretDrop> {
    return this.updateSecretDropStatus(uuid, 'publish');
  }

  async unpublishSecretDrop(uuid: string): Promise<SecretDrop> {
    return this.updateSecretDropStatus(uuid, 'unpublish');
  }

  private async updateSecretDropStatus(uuid: string, action: 'publish' | 'unpublish'): Promise<SecretDrop> {
    const response = await firstValueFrom(
      this.http.post<SecretDropUpdateResponse>(`${this.baseUrl}/${action}/${encodeURIComponent(uuid)}`, {})
    );
    const secretDrop = this.normalizeSecretDrop(response.secretDrop);
    this.mySecretDropsSignal.update((drops) => drops.map((drop) => drop.uuid === uuid ? secretDrop : drop));
    return secretDrop;
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
      hintStyle: source.hintStyle ?? '',
      message: source.message ?? '',
      messageStyle: source.messageStyle ?? '',
      multimedia: source.multimedia ?? null,
      publishState: source.publishState ?? (source.status === 'enabled' ? 'published' : 'unpublished'),
      localOnly: source.localOnly ?? false,
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
