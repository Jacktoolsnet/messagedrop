import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, defer, from, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { DsaStatusResponse } from '../interfaces/dsa-status-response.interface';
import { PowService } from './pow.service';

@Injectable({ providedIn: 'root' })
export class DsaStatusService {
  private readonly baseUrl = `${environment.apiUrl}/dsa/status`;
  private readonly http = inject(HttpClient);
  private readonly pow = inject(PowService);

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
    const url = `${this.baseUrl}/${encodeURIComponent(token)}/appeals`;
    return this.postWithPow<{ id: string }>(url, payload);
  }

  uploadAppealEvidence(token: string, appealId: string, file: File) {
    const url = `${this.baseUrl}/${encodeURIComponent(token)}/appeals/${encodeURIComponent(appealId)}/evidence`;
    return this.postWithPowFactory<{ id: string }>(url, () => {
      const form = new FormData();
      form.append('file', file);
      return form;
    });
  }

  uploadAppealUrlEvidence(token: string, appealId: string, url: string) {
    const endpoint = `${this.baseUrl}/${encodeURIComponent(token)}/appeals/${encodeURIComponent(appealId)}/evidence/url`;
    return this.postWithPow<{ id: string }>(endpoint, { url });
  }

  private postWithPow<T>(url: string, body: unknown, options?: { headers?: HttpHeaders; withCredentials?: boolean }) {
    return defer(() => this.http.post<T>(url, body, options)).pipe(
      catchError((err) => {
        const challenge = this.pow.extractChallenge(err);
        if (!challenge) return throwError(() => err);
        return from(this.pow.solve(challenge)).pipe(
          switchMap((solution) => {
            const headers = (options?.headers || new HttpHeaders()).set('X-PoW', solution.headerValue);
            return this.http.post<T>(url, body, { ...options, headers });
          })
        );
      })
    );
  }

  private postWithPowFactory<T>(
    url: string,
    buildBody: () => unknown,
    options?: { headers?: HttpHeaders; withCredentials?: boolean }
  ) {
    return defer(() => this.http.post<T>(url, buildBody(), options)).pipe(
      catchError((err) => {
        const challenge = this.pow.extractChallenge(err);
        if (!challenge) return throwError(() => err);
        return from(this.pow.solve(challenge)).pipe(
          switchMap((solution) => {
            const headers = (options?.headers || new HttpHeaders()).set('X-PoW', solution.headerValue);
            return this.http.post<T>(url, buildBody(), { ...options, headers });
          })
        );
      })
    );
  }
}
