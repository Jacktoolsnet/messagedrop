import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  OverpassDatabaseInfo,
  OverpassImportCatalog,
  OverpassImportJob,
  OverpassMetadataJob,
  OverpassImportSettings,
  OverpassImportSettingsResponse
} from '../interfaces/overpass-import.interface';

@Injectable({ providedIn: 'root' })
export class OverpassImportService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/overpass-import`;

  getSettings(): Observable<OverpassImportSettingsResponse> {
    return this.http.get<OverpassImportSettingsResponse>(`${this.baseUrl}/settings`);
  }

  getCatalog(): Observable<OverpassImportCatalog> {
    return this.http.get<OverpassImportCatalog>(`${this.baseUrl}/catalog`);
  }

  updateSettings(settings: OverpassImportSettings): Observable<OverpassImportSettingsResponse> {
    return this.http.put<OverpassImportSettingsResponse>(`${this.baseUrl}/settings`, settings);
  }

  getDatabaseInfo(): Observable<OverpassDatabaseInfo> {
    return this.http.get<OverpassDatabaseInfo>(`${this.baseUrl}/database-info`);
  }

  getJobs(): Observable<{ status: number; jobs: OverpassImportJob[]; metadataJobs: OverpassMetadataJob[] }> {
    return this.http.get<{ status: number; jobs: OverpassImportJob[]; metadataJobs: OverpassMetadataJob[] }>(`${this.baseUrl}/jobs`);
  }

  startImport(force = false): Observable<{ status: number; jobs: unknown[] }> {
    return this.http.post<{ status: number; jobs: unknown[] }>(`${this.baseUrl}/jobs`, { force });
  }
}
