import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  SecretDrop,
  SecretDropCreateRequest,
  SecretDropComment,
  SecretDropCommentCreateResponse,
  SecretDropCommentDeleteResponse,
  SecretDropCommentListResponse,
  SecretDropCreateResponse,
  SecretDropDeleteResponse,
  SecretDropListResponse,
  SecretDropStatsResponse,
  SecretDropUnlockResponse,
  SecretDropUpdateResponse,
  SecretDropCommentUpdateResponse
} from '../interfaces/secret-drop';
import { IndexedDbService } from './indexed-db.service';

export interface SecretDropReactionResponse {
  status: number;
  uuid: string;
  likes: number;
  dislikes: number;
  liked?: boolean;
  disliked?: boolean;
}

@Injectable({ providedIn: 'root' })
export class SecretDropService {
  private readonly http = inject(HttpClient);
  private readonly indexedDb = inject(IndexedDbService);
  private readonly baseUrl = `${environment.apiUrl}/secretdrop`;
  readonly mySecretDropsSignal = signal<SecretDrop[]>([]);

  async createSecretDrop(request: SecretDropCreateRequest, localPlainData?: Partial<SecretDrop>): Promise<SecretDrop> {
    const response = await firstValueFrom(this.http.post<SecretDropCreateResponse>(`${this.baseUrl}/create`, request));
    const isIncognito = request.creatorMode === 'incognito';
    const secretDrop = this.normalizeSecretDrop({
      ...response.secretDrop,
      ...(isIncognito ? {} : localPlainData),
      creatorMode: isIncognito ? 'incognito' : (response.secretDrop.creatorMode ?? localPlainData?.creatorMode ?? 'normal'),
      publishState: 'published',
      localOnly: false
    });
    if (isIncognito) {
      return secretDrop;
    }
    this.mySecretDropsSignal.update((drops) => [secretDrop, ...drops.filter((drop) => drop.uuid !== secretDrop.uuid)]);
    await this.saveOwnSecretDrops(request.userId, this.mySecretDropsSignal());
    return secretDrop;
  }

  async loadMySecretDrops(userId: string): Promise<SecretDrop[]> {
    const localRows = await this.loadOwnSecretDrops(userId);
    const response = await firstValueFrom(this.http.get<SecretDropListResponse>(`${this.baseUrl}/my/${encodeURIComponent(userId)}`));
    const localByUuid = new Map(localRows.map((drop) => [drop.uuid, drop]));
    const serverRows = (response.rows ?? [])
      .filter((row) => row.creatorMode !== 'incognito')
      .map((row) => {
      const local = localByUuid.get(row.uuid);
      return this.normalizeSecretDrop({
        ...row,
        message: local?.message,
        messageStyle: local?.messageStyle,
        multimedia: local?.multimedia,
        localSecretPin: local?.localSecretPin ?? null,
        visibility: row.visibility ?? local?.visibility ?? 'public',
        creatorMode: row.creatorMode ?? local?.creatorMode ?? 'normal',
        recipientUserIds: row.recipientUserIds ?? local?.recipientUserIds ?? [],
        publishState: row.status === 'disabled' && row.dsaStatusToken ? 'dsa_locked' : (row.status === 'enabled' ? 'published' : 'unpublished'),
        discoveryZoomLevel: local?.discoveryZoomLevel ?? row.discoveryZoomLevel,
        localOnly: false
      });
    });
    const rows = this.mergeOwnSecretDrops(localRows, serverRows);
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
      status: drop.status ?? 'disabled',
      publishState: drop.publishState ?? 'draft',
      localOnly: drop.localOnly ?? true,
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


  async discoverByPlusCode(plusCode: string, zoomLevel: number): Promise<SecretDrop[]> {
    const encodedPlusCode = encodeURIComponent(plusCode);
    const response = await firstValueFrom(
      this.http.get<SecretDropListResponse>(`${this.baseUrl}/discover/pluscode/${encodedPlusCode}?zoom=${encodeURIComponent(String(Math.round(zoomLevel)))}`)
    );
    return (response.rows ?? []).map((row) => this.normalizeSecretDrop(row));
  }

  async unlockSecretDrop(uuid: string, authVerifier: string): Promise<SecretDrop> {
    const response = await firstValueFrom(
      this.http.post<SecretDropUnlockResponse>(
        `${this.baseUrl}/unlock/${encodeURIComponent(uuid)}`,
        { authVerifier },
        { headers: new HttpHeaders({ 'x-skip-ui': 'true' }) }
      )
    );
    return this.normalizeSecretDrop(response.secretDrop);
  }


  async toggleReaction(uuid: string, reaction: 'like' | 'dislike'): Promise<SecretDropReactionResponse> {
    return firstValueFrom(
      this.http.post<SecretDropReactionResponse>(
        `${this.baseUrl}/${encodeURIComponent(uuid)}/${reaction}`,
        {},
        { headers: new HttpHeaders({ 'x-skip-ui': 'true' }) }
      )
    );
  }


  async getComments(uuid: string): Promise<SecretDropComment[]> {
    const response = await firstValueFrom(
      this.http.get<SecretDropCommentListResponse>(
        `${this.baseUrl}/${encodeURIComponent(uuid)}/comments`,
        { headers: new HttpHeaders({ 'x-skip-ui': 'true' }) }
      )
    );
    return (response.rows ?? []).map((row) => this.normalizeComment(row));
  }

  async addComment(
    uuid: string,
    request: Pick<SecretDropComment, 'encryptedPayload' | 'crypto'> & { parentCommentUuid?: string | null }
  ): Promise<SecretDropComment> {
    const response = await firstValueFrom(
      this.http.post<SecretDropCommentCreateResponse>(
        `${this.baseUrl}/${encodeURIComponent(uuid)}/comments`,
        request,
        { headers: new HttpHeaders({ 'x-skip-ui': 'true' }) }
      )
    );
    return this.normalizeComment(response.comment);
  }


  async updateComment(
    uuid: string,
    commentUuid: string,
    request: Pick<SecretDropComment, 'encryptedPayload' | 'crypto'>
  ): Promise<SecretDropComment> {
    const response = await firstValueFrom(
      this.http.put<SecretDropCommentUpdateResponse>(
        `${this.baseUrl}/${encodeURIComponent(uuid)}/comments/${encodeURIComponent(commentUuid)}`,
        request,
        { headers: new HttpHeaders({ 'x-skip-ui': 'true' }) }
      )
    );
    return this.normalizeComment(response.comment);
  }

  async deleteComment(uuid: string, commentUuid: string): Promise<boolean> {
    const response = await firstValueFrom(
      this.http.delete<SecretDropCommentDeleteResponse>(
        `${this.baseUrl}/${encodeURIComponent(uuid)}/comments/${encodeURIComponent(commentUuid)}`,
        { headers: new HttpHeaders({ 'x-skip-ui': 'true' }) }
      )
    );
    return !!response.deleted;
  }


  async toggleCommentReaction(
    uuid: string,
    commentUuid: string,
    reaction: 'like' | 'dislike'
  ): Promise<SecretDropReactionResponse> {
    return firstValueFrom(
      this.http.post<SecretDropReactionResponse>(
        `${this.baseUrl}/${encodeURIComponent(uuid)}/comments/${encodeURIComponent(commentUuid)}/${reaction}`,
        {},
        { headers: new HttpHeaders({ 'x-skip-ui': 'true' }) }
      )
    );
  }

  async getStats(uuid: string): Promise<SecretDropStatsResponse> {
    return firstValueFrom(this.http.get<SecretDropStatsResponse>(`${this.baseUrl}/stats/${encodeURIComponent(uuid)}`));
  }

  async deleteSecretDrop(uuid: string): Promise<boolean> {
    const existing = this.mySecretDropsSignal().find((drop) => drop.uuid === uuid);
    const response = await firstValueFrom(this.http.delete<SecretDropDeleteResponse>(`${this.baseUrl}/delete/${encodeURIComponent(uuid)}`));
    if (response.deleted) {
      this.mySecretDropsSignal.update((drops) => drops.filter((drop) => drop.uuid !== uuid));
      const userId = existing?.userId ?? '';
      if (userId) {
        await this.saveOwnSecretDrops(userId, this.mySecretDropsSignal());
      }
    }
    return !!response.deleted;
  }


  async republishSecretDrop(uuid: string, request: SecretDropCreateRequest, localPlainData?: Partial<SecretDrop>): Promise<SecretDrop> {
    const response = await firstValueFrom(
      this.http.post<SecretDropUpdateResponse>(`${this.baseUrl}/republish/${encodeURIComponent(uuid)}`, request)
    );
    const existing = this.mySecretDropsSignal().find((drop) => drop.uuid === uuid);
    const isIncognito = request.creatorMode === 'incognito';
    const secretDrop = this.normalizeSecretDrop({
      ...response.secretDrop,
      ...(isIncognito ? {} : localPlainData),
      creatorMode: isIncognito ? 'incognito' : (response.secretDrop.creatorMode ?? localPlainData?.creatorMode ?? 'normal'),
      publishState: 'published',
      localOnly: false
    });
    const userId = request.userId || secretDrop.userId || existing?.userId || '';
    if (isIncognito) {
      this.mySecretDropsSignal.update((drops) => drops.filter((drop) => drop.uuid !== uuid));
      if (userId) {
        await this.saveOwnSecretDrops(userId, this.mySecretDropsSignal());
      }
      return secretDrop;
    }
    this.mySecretDropsSignal.update((drops) => drops.some((drop) => drop.uuid === uuid)
      ? drops.map((drop) => drop.uuid === uuid ? secretDrop : drop)
      : [secretDrop, ...drops]);
    if (userId) {
      await this.saveOwnSecretDrops(userId, this.mySecretDropsSignal());
    }
    return secretDrop;
  }

  async publishSecretDrop(uuid: string): Promise<SecretDrop> {
    return this.updateSecretDropStatus(uuid, 'publish');
  }

  async unpublishSecretDrop(uuid: string): Promise<SecretDrop> {
    return this.updateSecretDropStatus(uuid, 'unpublish');
  }

  private async updateSecretDropStatus(uuid: string, action: 'publish' | 'unpublish'): Promise<SecretDrop> {
    const existing = this.mySecretDropsSignal().find((drop) => drop.uuid === uuid);
    const response = await firstValueFrom(
      this.http.post<SecretDropUpdateResponse>(`${this.baseUrl}/${action}/${encodeURIComponent(uuid)}`, {})
    );
    const secretDrop = this.normalizeSecretDrop({
      ...response.secretDrop,
      message: existing?.message ?? '',
      messageStyle: existing?.messageStyle ?? '',
      multimedia: existing?.multimedia ?? null,
      localSecretPin: existing?.localSecretPin ?? null,
      visibility: existing?.visibility ?? response.secretDrop.visibility ?? 'public',
      creatorMode: existing?.creatorMode ?? response.secretDrop.creatorMode ?? 'normal',
      recipientUserIds: existing?.recipientUserIds ?? response.secretDrop.recipientUserIds ?? [],
      publishState: action === 'publish' ? 'published' : 'unpublished',
      localOnly: false
    });
    this.mySecretDropsSignal.update((drops) => drops.map((drop) => drop.uuid === uuid ? secretDrop : drop));
    const userId = secretDrop.userId || existing?.userId || '';
    if (userId) {
      await this.saveOwnSecretDrops(userId, this.mySecretDropsSignal());
    }
    return secretDrop;
  }



  private parseJsonField<T = unknown>(value: T | string | null | undefined): T | string | null {
    if (typeof value !== 'string') {
      return value ?? null;
    }
    try {
      return JSON.parse(value) as T;
    } catch {
      return value;
    }
  }

  private normalizeDiscoveryZoomLevel(value: unknown): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return 18;
    }
    return Math.min(19, Math.max(12, Math.round(numeric)));
  }


  private normalizeComment(raw: SecretDropComment): SecretDropComment {
    return {
      ...raw,
      encryptedPayload: this.parseJsonField(raw.encryptedPayload) as SecretDropComment['encryptedPayload'],
      crypto: this.parseJsonField(raw.crypto) as SecretDropComment['crypto'],
      parentCommentUuid: raw.parentCommentUuid ?? null,
      likes: Number(raw.likes ?? 0),
      dislikes: Number(raw.dislikes ?? 0),
      commentsNumber: Number(raw.commentsNumber ?? 0),
      createdAt: Number(raw.createdAt ?? 0)
    };
  }

  private mergeOwnSecretDrops(localRows: SecretDrop[], serverRows: SecretDrop[]): SecretDrop[] {
    const merged = new Map<string, SecretDrop>();
    const serverUuids = new Set<string>();

    for (const serverDrop of serverRows ?? []) {
      const uuid = String(serverDrop?.uuid ?? '').trim();
      if (!uuid) {
        continue;
      }
      serverUuids.add(uuid);
      merged.set(uuid, this.normalizeSecretDrop(serverDrop));
    }

    for (const localDrop of localRows ?? []) {
      const uuid = String(localDrop?.uuid ?? '').trim();
      if (!uuid || serverUuids.has(uuid) || localDrop.creatorMode === 'incognito') {
        continue;
      }

      const localState = localDrop.publishState ?? (localDrop.status === 'enabled' ? 'published' : 'unpublished');
      const nextState = localState === 'draft' || localState === 'local_only'
        ? localState
        : 'unpublished';

      merged.set(uuid, this.normalizeSecretDrop({
        ...localDrop,
        status: nextState === 'draft' || nextState === 'local_only'
          ? (localDrop.status ?? 'disabled')
          : 'disabled',
        publishState: nextState === 'local_only' ? 'draft' : nextState,
        localOnly: true
      }));
    }

    return Array.from(merged.values()).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
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
      discoveryZoomLevel: this.normalizeDiscoveryZoomLevel(source.discoveryZoomLevel),
      hintStyle: source.hintStyle ?? '',
      message: source.message ?? '',
      messageStyle: source.messageStyle ?? '',
      multimedia: source.multimedia ?? null,
      localSecretPin: typeof source.localSecretPin === 'string' && source.localSecretPin.length > 0 ? source.localSecretPin : null,
      visibility: source.visibility === 'contacts' ? 'contacts' : 'public',
      creatorMode: source.creatorMode === 'incognito' ? 'incognito' : 'normal',
      recipientUserIds: Array.isArray(source.recipientUserIds) ? source.recipientUserIds.map((id) => String(id)).filter(Boolean) : [],
      crypto: this.parseJsonField(source.crypto),
      encryptedPayload: this.parseJsonField(source.encryptedPayload),
      dsaStatusToken: source.dsaStatusToken ?? null,
      dsaStatusTokenCreatedAt: source.dsaStatusTokenCreatedAt === null || source.dsaStatusTokenCreatedAt === undefined ? null : Number(source.dsaStatusTokenCreatedAt),
      publishState: source.publishState ?? (source.status === 'disabled' && source.dsaStatusToken ? 'dsa_locked' : (source.status === 'enabled' ? 'published' : 'unpublished')),
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
