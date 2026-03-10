import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { MaintenanceBackupResponse, MaintenanceResponse } from '../interfaces/maintenance.interface';

export interface MaintenanceUpdatePayload {
  enabled: boolean;
  startsAt: number | null;
  endsAt: number | null;
  reason: string | null;
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

  downloadBackup(backupId: string): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.baseUrl}/backup/${encodeURIComponent(backupId)}/download`, {
      observe: 'response',
      responseType: 'blob'
    } as const);
  }
}
