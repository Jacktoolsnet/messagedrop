import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

import { NetworkService } from './network.service';

// deine Interfaces (ggf. Pfade anpassen)
import { CreateDsaNotice } from '../interfaces/create-dsa-notice.interface';
import { CreateDsaSignal } from '../interfaces/create-dsa-signal.interface';

export interface DsaSubmissionResponse {
  id: string;
  token?: string | null;
  statusUrl?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class DigitalServicesActService {
  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      'X-API-Authorization': `${environment.apiToken}`
    }),
    withCredentials: true
  };

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar,
    private networkService: NetworkService
  ) { }

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  /**
   * Quick-Report (Signal) absenden
   * POST {apiUrl}/dsa/signals
   */
  submitSignal(payload: CreateDsaSignal): Observable<DsaSubmissionResponse> {
    const url = `${environment.apiUrl}/digitalserviceact/signals`;

    this.networkService.setNetworkMessageConfig(url, {
      showAlways: false,
      title: 'DSA',
      image: '',
      icon: '',
      message: 'Sending quick report…',
      button: '',
      delay: 0,
      showSpinner: true
    });

    const body = {
      contentId: payload.contentId,
      contentUrl: payload.contentUrl,
      category: payload.category,
      reasonText: payload.reasonText,
      reportedContentType: payload.contentType,
      reportedContent: payload.content
    };

    return this.http.post<DsaSubmissionResponse>(url, body, this.httpOptions)
      .pipe(catchError(this.handleError));
  }

  /**
   * Formale DSA-Notice absenden
   * POST {apiUrl}/dsa/notices
   */
  submitNotice(payload: CreateDsaNotice): Observable<DsaSubmissionResponse> {
    const url = `${environment.apiUrl}/digitalserviceact/notices`;

    this.networkService.setNetworkMessageConfig(url, {
      showAlways: false,
      title: 'DSA',
      image: '',
      icon: '',
      message: 'Submitting DSA notice…',
      button: '',
      delay: 0,
      showSpinner: true
    });

    // Body entsprechend unserer Backend-Route (alle Felder optional außer contentId)
    const body: any = {
      contentId: payload.contentId,
      contentUrl: payload.contentUrl,
      category: payload.category,
      reasonText: payload.reasonText,
      reporterEmail: payload.email,
      reporterName: payload.name,
      truthAffirmation: payload.truthAffirmation,
      reportedContentType: payload.contentType,
      reportedContent: payload.content
    };

    return this.http.post<DsaSubmissionResponse>(url, body, this.httpOptions)
      .pipe(catchError(this.handleError));
  }

  /** Attach evidence to a created notice */
  addNoticeEvidence(
    noticeId: string,
    data: { type: 'file' | 'url' | 'hash'; url?: string | null; hash?: string | null; file?: File | null }
  ): Observable<{ id: string }> {
    const url = `${environment.apiUrl}/digitalserviceact/notices/${encodeURIComponent(noticeId)}/evidence`;
    if (data.type === 'file' && data.file) {
      const form = new FormData();
      form.append('type', 'file');
      form.append('file', data.file);
      if (data.hash) form.append('hash', data.hash);
      const headers = new HttpHeaders({ 'X-API-Authorization': `${environment.apiToken}` });
      return this.http.post<{ id: string }>(url, form, { headers, withCredentials: true }).pipe(
        catchError(this.handleError)
      );
    }
    const body = { type: data.type, url: data.url ?? null, hash: data.hash ?? null } as const;
    return this.http.post<{ id: string }>(url, body, this.httpOptions).pipe(
      catchError(this.handleError)
    );
  }

  /** Attach evidence using public token (no admin auth required) */
  addNoticeEvidenceByToken(
    token: string,
    data: { type: 'file' | 'url' | 'hash'; url?: string | null; hash?: string | null; file?: File | null }
  ): Observable<{ id: string }> {
    const url = `${environment.apiUrl}/digitalserviceact/status/${encodeURIComponent(token)}/evidence`;
    if (data.type === 'file' && data.file) {
      const form = new FormData();
      form.append('file', data.file);
      if (data.hash) form.append('hash', data.hash);
      const headers = new HttpHeaders({ 'X-API-Authorization': `${environment.apiToken}` });
      return this.http.post<{ id: string }>(url, form, { headers, withCredentials: true }).pipe(
        catchError(this.handleError)
      );
    }
    const body = { type: data.type, url: data.url ?? null, hash: data.hash ?? null } as const;
    return this.http.post<{ id: string }>(url, body, this.httpOptions).pipe(
      catchError(this.handleError)
    );
  }

  /** Attach evidence to a created signal */
  addSignalEvidence(
    signalId: string,
    data: { type: 'file' | 'url' | 'hash'; url?: string | null; hash?: string | null; file?: File | null }
  ): Observable<{ id: string }> {
    const url = `${environment.apiUrl}/digitalserviceact/signals/${encodeURIComponent(signalId)}/evidence`;
    if (data.type === 'file' && data.file) {
      const form = new FormData();
      form.append('type', 'file');
      form.append('file', data.file);
      if (data.hash) form.append('hash', data.hash);
      const headers = new HttpHeaders({ 'X-API-Authorization': `${environment.apiToken}` });
      return this.http.post<{ id: string }>(url, form, { headers, withCredentials: true }).pipe(
        catchError(this.handleError)
      );
    }
    const body = { type: data.type, url: data.url ?? null, hash: data.hash ?? null } as const;
    return this.http.post<{ id: string }>(url, body, this.httpOptions).pipe(
      catchError(this.handleError)
    );
  }

}
