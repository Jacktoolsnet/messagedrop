import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { MaintenanceResponse } from '../interfaces/maintenance.interface';

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
}
