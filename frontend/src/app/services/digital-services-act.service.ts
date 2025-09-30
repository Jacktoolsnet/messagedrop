import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateDsaAppeal } from '../interfaces/create-dsa-appeal.interface';
import { CreateDsaNotice } from '../interfaces/create-dsa-notice.interface';
import { DsaNoticeStatus } from '../interfaces/dsa-notice-status.interface';
import { DsaNotice } from '../interfaces/dsa-notice.interface';
import { DsaTransparencySummary } from '../interfaces/dsa-transparency-summary.interface';

@Injectable({ providedIn: 'root' })
export class DigitalServicesActService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/dsa';

  // ---- Notice & Action ----

  /** Meldung (Notice) erstellen – vom Dialog aufgerufen */
  createNotice(dto: CreateDsaNotice): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.base}/notices`, dto);
  }

  /** Einzelne Notice abrufen (für Admin/Moderation-UI) */
  getNotice(id: string): Observable<DsaNotice> {
    return this.http.get<DsaNotice>(`${this.base}/notices/${encodeURIComponent(id)}`);
  }

  /**
   * Notices listen – optional nach Status filtern und pagination anwenden.
   * Beispiel: listNotices({ status: 'UNDER_REVIEW', limit: 50, offset: 0 })
   */
  listNotices(opts?: {
    status?: DsaNoticeStatus | DsaNoticeStatus[];
    limit?: number;
    offset?: number;
  }): Observable<DsaNotice[]> {
    let params = new HttpParams();

    if (opts?.status) {
      // Mehrfachstatus unterstützen
      const statuses = Array.isArray(opts.status) ? opts.status : [opts.status];
      statuses.forEach(s => params = params.append('status', s));
    }
    if (typeof opts?.limit === 'number') params = params.set('limit', String(opts.limit));
    if (typeof opts?.offset === 'number') params = params.set('offset', String(opts.offset));

    return this.http.get<DsaNotice[]>(`${this.base}/notices`, { params });
  }

  // ---- Interne Beschwerde (Appeal) ----

  /** Interne Beschwerde gegen eine Entscheidung einreichen */
  submitInternalAppeal(dto: CreateDsaAppeal): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.base}/appeals`, dto);
  }

  // ---- Transparenz ----

  /** Kompakte Kennzahlen für Transparenzberichte */
  getTransparencySummary(period?: string): Observable<DsaTransparencySummary> {
    const params = period ? new HttpParams().set('period', period) : undefined;
    return this.http.get<DsaTransparencySummary>(`${this.base}/transparency/summary`, { params });
  }
}