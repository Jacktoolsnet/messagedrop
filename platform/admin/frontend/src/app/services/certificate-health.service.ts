import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CertificateHealthOverviewResponse } from '../interfaces/certificate-health.interface';

@Injectable({ providedIn: 'root' })
export class CertificateHealthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/certificate-health`;

  getOverview(): Observable<CertificateHealthOverviewResponse> {
    return this.http.get<CertificateHealthOverviewResponse>(this.baseUrl);
  }

  runCheck(): Observable<CertificateHealthOverviewResponse> {
    return this.http.post<CertificateHealthOverviewResponse>(`${this.baseUrl}/check`, {});
  }
}
