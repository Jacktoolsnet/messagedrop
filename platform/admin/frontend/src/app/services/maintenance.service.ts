import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  MaintenanceBackupListResponse,
  MaintenanceBackupResponse,
  MaintenanceBackupValidationResponse,
  MaintenanceRestoreChallengeResponse,
  MaintenanceRestorePrepareResponse,
  MaintenanceRestoreStatusResponse,
  MaintenanceResponse
} from '../interfaces/maintenance.interface';

export interface MaintenanceUpdatePayload {
  enabled: boolean;
  startsAt: number | null;
  endsAt: number | null;
  reason: string | null;
}

export interface MaintenanceRestorePreparePayload {
  backupId: string;
  challengeId: string;
  confirmationWord: string;
  confirmationPin: string;
}

@Injectable({ providedIn: 'root' })
export class MaintenanceService {
  private readonly baseUrl = `${environment.apiUrl}/maintenance`;
  private readonly http = inject(HttpClient);

  getStatus(): Observable<MaintenanceResponse> {
    return this.http.get<MaintenanceResponse>(this.baseUrl);
  }

  update(payload: MaintenanceUpdatePayload): Observable<MaintenanceResponse> {
    return this.http.put<MaintenanceResponse>(this.baseUrl, payload);
  }

  createBackup(): Observable<MaintenanceBackupResponse> {
    return this.http.post<MaintenanceBackupResponse>(`${this.baseUrl}/backup`, {});
  }

  getLatestBackup(): Observable<MaintenanceBackupResponse> {
    return this.http.get<MaintenanceBackupResponse>(`${this.baseUrl}/backup/latest`);
  }

  listBackups(): Observable<MaintenanceBackupListResponse> {
    return this.http.get<MaintenanceBackupListResponse>(`${this.baseUrl}/backup/list`);
  }

  validateBackup(backupId: string): Observable<MaintenanceBackupValidationResponse> {
    return this.http.get<MaintenanceBackupValidationResponse>(`${this.baseUrl}/backup/${encodeURIComponent(backupId)}/validate`);
  }

  downloadBackup(backupId: string): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.baseUrl}/backup/${encodeURIComponent(backupId)}/download`, {
      observe: 'response',
      responseType: 'blob'
    } as const);
  }

  getRestoreStatus(): Observable<MaintenanceRestoreStatusResponse> {
    return this.http.get<MaintenanceRestoreStatusResponse>(`${this.baseUrl}/restore/status`);
  }

  createRestoreChallenge(backupId: string): Observable<MaintenanceRestoreChallengeResponse> {
    return this.http.post<MaintenanceRestoreChallengeResponse>(`${this.baseUrl}/restore/challenge`, { backupId });
  }

  prepareRestore(payload: MaintenanceRestorePreparePayload): Observable<MaintenanceRestorePrepareResponse> {
    return this.http.post<MaintenanceRestorePrepareResponse>(`${this.baseUrl}/restore/prepare`, payload);
  }
}
