import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, defer, Observable, of, switchMap } from 'rxjs';
import { ADMIN_SESSION_CHANGED_EVENT, getValidStoredAdminToken } from '../utils/admin-token.util';
import { environment } from '../../environments/environment';
import {
  GeodataDatabaseInfo,
  GeodataImportCatalog,
  GeodataImportJob,
  GeodataImportJobsResponse,
  GeodataImportSettings,
  GeodataImportSettingsResponse
} from '../interfaces/geodata-import.interface';

@Injectable({ providedIn: 'root' })
export class GeodataImportService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/geodata-import`;

  watchJobs(): Observable<GeodataImportJobsResponse | null> {
    return defer(() => import('socket.io-client')).pipe(switchMap(({ io }) => new Observable<GeodataImportJobsResponse | null>(subscriber => {
      const url = new URL(environment.apiUrl, window.location.origin);
      const socket = io(url.origin, {
        path: `${url.pathname.replace(/\/$/, '')}/socket.io`,
        transports: ['websocket'],
        autoConnect: false,
        auth: callback => callback({ token: getValidStoredAdminToken() || '' })
      });
      let snapshotTimeout: ReturnType<typeof setTimeout> | undefined;
      socket.on('connect', () => {
        clearTimeout(snapshotTimeout);
        snapshotTimeout = setTimeout(() => subscriber.next(null), 10000);
        socket.emit('geodata:subscribe');
      });
      socket.on('geodata:snapshot', (value: GeodataImportJobsResponse) => {
        clearTimeout(snapshotTimeout);
        subscriber.next(value);
      });
      const unavailable = () => subscriber.next(null);
      socket.on('geodata:unavailable', unavailable);
      socket.on('disconnect', unavailable);
      socket.on('connect_error', unavailable);
      const sessionChanged = () => {
        socket.disconnect();
        if (getValidStoredAdminToken()) socket.connect();
        else unavailable();
      };
      window.addEventListener(ADMIN_SESSION_CHANGED_EVENT, sessionChanged);
      window.addEventListener('storage', sessionChanged);
      socket.connect();
      return () => {
        window.removeEventListener(ADMIN_SESSION_CHANGED_EVENT, sessionChanged);
        window.removeEventListener('storage', sessionChanged);
        clearTimeout(snapshotTimeout);
        socket.removeAllListeners();
        socket.disconnect();
      };
    })), catchError(() => of(null)));
  }

  getSettings(): Observable<GeodataImportSettingsResponse> {
    return this.http.get<GeodataImportSettingsResponse>(`${this.baseUrl}/settings`);
  }

  getCatalog(): Observable<GeodataImportCatalog> {
    return this.http.get<GeodataImportCatalog>(`${this.baseUrl}/catalog`);
  }

  updateSettings(settings: GeodataImportSettings): Observable<GeodataImportSettingsResponse> {
    return this.http.put<GeodataImportSettingsResponse>(`${this.baseUrl}/settings`, settings);
  }

  getDatabaseInfo(): Observable<GeodataDatabaseInfo> {
    return this.http.get<GeodataDatabaseInfo>(`${this.baseUrl}/database-info`);
  }

  getJobs(): Observable<GeodataImportJobsResponse> {
    return this.http.get<GeodataImportJobsResponse>(`${this.baseUrl}/jobs`);
  }

  startImport(force = false): Observable<{ status: number; jobs: unknown[] }> {
    return this.http.post<{ status: number; jobs: unknown[] }>(`${this.baseUrl}/jobs`, { force });
  }

  retryImport(jobId: string): Observable<{ status: number; job: GeodataImportJob; created: boolean }> {
    return this.http.post<{ status: number; job: GeodataImportJob; created: boolean }>(
      `${this.baseUrl}/jobs/${encodeURIComponent(jobId)}/retry`, {});
  }
}
