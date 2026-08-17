import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  GeodataDatabaseInfo,
  GeodataImportCatalog,
  GeodataImportJob,
  GeodataMetadataJob,
  GeodataImportSettings,
  GeodataImportSettingsResponse
} from '../interfaces/geodata-import.interface';

@Injectable({ providedIn: 'root' })
export class GeodataImportService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/geodata-import`;

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

  getJobs(): Observable<{ status: number; jobs: GeodataImportJob[]; metadataJobs: GeodataMetadataJob[] }> {
    return this.http.get<{ status: number; jobs: GeodataImportJob[]; metadataJobs: GeodataMetadataJob[] }>(`${this.baseUrl}/jobs`);
  }

  startImport(force = false): Observable<{ status: number; jobs: unknown[] }> {
    return this.http.post<{ status: number; jobs: unknown[] }>(`${this.baseUrl}/jobs`, { force });
  }
}
