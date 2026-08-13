import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { OverpassImportCatalog, OverpassImportSettings, OverpassImportSettingsResponse } from '../interfaces/overpass-import.interface';

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
}
