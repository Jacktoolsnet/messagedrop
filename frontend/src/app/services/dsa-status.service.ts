import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { DsaStatusAppeal } from '../interfaces/dsa-status-appeal.interface';
import { DsaStatusEvidence } from '../interfaces/dsa-status-evidence.interface';
import { DsaStatusResponse } from '../interfaces/dsa-status-response.interface';

@Injectable({ providedIn: 'root' })
export class DsaStatusService {
  private readonly baseUrl = `${environment.apiUrl}/dsa/status`;

  constructor(private http: HttpClient) { }

  getStatus(token: string): Observable<DsaStatusResponse> {
    return this.http.get<DsaStatusResponse>(`${this.baseUrl}/${encodeURIComponent(token)}`);
  }

  downloadEvidence(token: string, evidenceId: string) {
    return this.http.get(`${this.baseUrl}/${encodeURIComponent(token)}/evidence/${encodeURIComponent(evidenceId)}`, {
      observe: 'response',
      responseType: 'blob'
    });
  }

  createAppeal(token: string, payload: { arguments: string; contact?: string; url?: string }): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.baseUrl}/${encodeURIComponent(token)}/appeals`, payload);
  }

  uploadAppealEvidence(token: string, appealId: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ id: string }>(`${this.baseUrl}/${encodeURIComponent(token)}/appeals/${encodeURIComponent(appealId)}/evidence`, form);
  }

  uploadAppealUrlEvidence(token: string, appealId: string, url: string) {
    return this.http.post<{ id: string }>(
      `${this.baseUrl}/${encodeURIComponent(token)}/appeals/${encodeURIComponent(appealId)}/evidence/url`,
      { url }
    );
  }
}
