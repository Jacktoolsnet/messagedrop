import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, forkJoin, map, Observable, of } from 'rxjs';
import { environment } from '../../../../environments/environment';

import { DsaSignal } from '../../../interfaces/dsa-signal.interface';
import { ListSignalsParams } from '../../../interfaces/list-signals-params.interface';
import { NoticeStats } from '../../../interfaces/notice-stats.interface';
import { PromoteResult } from '../../../interfaces/promote-result.interface';
import { SignalStats } from '../../../interfaces/signal-stats.interface';

import { DsaEvidence } from '../../../interfaces/dsa-evidence.interface';
import { DsaNoticeFilters } from '../../../interfaces/dsa-notice-filters.interface';
import { DsaNoticeStatus } from '../../../interfaces/dsa-notice-status.type';
import { DsaNotice } from '../../../interfaces/dsa-notice.interface';

@Injectable({ providedIn: 'root' })
export class DsaService {
  private readonly baseUrl = `${environment.apiUrl}/dsa/backend`;

  /** Dashboard-Stats-Loading */
  readonly loading = signal(false);
  readonly noticeStats = signal<NoticeStats | null>(null);
  readonly signalStats = signal<SignalStats | null>(null);

  constructor(
    private http: HttpClient,
    private snack: MatSnackBar
  ) { }

  /* =======================
   *  NOTICES (new / ergänzt)
   * ======================= */

  /** Liste der Notices mit Server-Parametern + optionalem Client-Filter */
  listNotices(filters: DsaNoticeFilters): Observable<DsaNotice[]> {
    let params = new HttpParams();

    // Server versteht: status (multi), contentId, type (= reportedContentType), limit, offset
    if (filters.status) {
      const arr = Array.isArray(filters.status) ? filters.status : [filters.status];
      arr.forEach(s => params = params.append('status', s));
    }
    if (filters.contentId) params = params.set('contentId', filters.contentId);
    if (filters.reportedContentType) params = params.set('type', filters.reportedContentType);
    if (typeof filters.limit === 'number') params = params.set('limit', String(filters.limit));
    if (typeof filters.offset === 'number') params = params.set('offset', String(filters.offset));

    return this.http.get<DsaNotice[]>(`${this.baseUrl}/notices`, { params }).pipe(
      // Clientseitig zusätzlich filtern (category, q, range)
      map(rows => this.applyNoticeClientFilters(rows ?? [], filters)),
      catchError(err => {
        this.snack.open('Could not load notices.', 'OK', { duration: 3000 });
        return of([]);
      })
    );
  }

  /** Einzelabruf einer Notice */
  getNoticeById(id: string): Observable<DsaNotice> {
    return this.http.get<DsaNotice>(`${this.baseUrl}/notices/${id}`).pipe(
      catchError(err => {
        this.snack.open('Could not load notice.', 'OK', { duration: 3000 });
        throw err;
      })
    );
  }

  /** Status einer Notice ändern (PATCH /notices/:id/status) */
  patchNoticeStatus(id: string, status: DsaNoticeStatus): Observable<{ ok: boolean }> {
    return this.http.patch<{ ok: boolean }>(`${this.baseUrl}/notices/${id}/status`, { status }).pipe(
      catchError(err => {
        this.snack.open('Could not update notice status.', 'OK', { duration: 3000 });
        throw err;
      })
    );
  }

  /** Clientseitiger Zusatzfilter (category, q, range) */
  private applyNoticeClientFilters(rows: DsaNotice[], f: DsaNoticeFilters): DsaNotice[] {
    let out = rows;

    // Zeitraum
    if (f.range && f.range !== 'all') {
      const now = Date.now();
      const delta =
        f.range === '24h' ? 24 * 60 * 60 * 1000 :
          f.range === '7d' ? 7 * 24 * 60 * 60 * 1000 :
            f.range === '30d' ? 30 * 24 * 60 * 60 * 1000 : 0;
      if (delta > 0) {
        const since = now - delta;
        out = out.filter(n => (n.createdAt ?? 0) >= since);
      }
    }

    // Kategorie
    if (f.category && f.category.trim().length) {
      const needle = f.category.toLowerCase();
      out = out.filter(n => (n.category || '').toLowerCase().includes(needle));
    }

    // Volltext light (reasonText, contentId)
    if (f.q && f.q.trim().length) {
      const q = f.q.toLowerCase();
      out = out.filter(n =>
        (n.reasonText || '').toLowerCase().includes(q) ||
        (n.contentId || '').toLowerCase().includes(q)
      );
    }

    return out;
  }

  /* =======================
   *  STATS
   * ======================= */

  loadNoticeStats(): void {
    this.loading.set(true);
    this.http.get<NoticeStats>(`${this.baseUrl}/stats/notices`)
      .pipe(
        catchError(err => {
          this.snack.open('Could not load notice stats.', 'OK', { duration: 3000 });
          this.loading.set(false);
          return of(null);
        })
      )
      .subscribe(res => {
        if (res) this.noticeStats.set(res);
        this.loading.set(false);
      });
  }

  loadSignalStats(): void {
    this.loading.set(true);
    this.http.get<SignalStats>(`${this.baseUrl}/stats/signals`)
      .pipe(
        catchError(err => {
          this.snack.open('Could not load signal stats.', 'OK', { duration: 3000 });
          this.loading.set(false);
          return of(null);
        })
      )
      .subscribe(res => {
        if (res) this.signalStats.set(res);
        this.loading.set(false);
      });
  }

  loadAllStats(): void {
    this.loading.set(true);
    forkJoin({
      notices: this.http.get<NoticeStats>(`${this.baseUrl}/stats/notices`)
        .pipe(catchError(() => of(null))),
      signals: this.http.get<SignalStats>(`${this.baseUrl}/stats/signals`)
        .pipe(catchError(() => of(null)))
    }).subscribe(({ notices, signals }) => {
      if (notices) this.noticeStats.set(notices);
      if (signals) this.signalStats.set(signals);
      if (!notices || !signals) {
        this.snack.open('Some DSA stats could not be loaded.', 'OK', { duration: 3000 });
      }
      this.loading.set(false);
    });
  }

  /* =======================
   *  SIGNALS (bestehend)
   * ======================= */

  listSignals(params: ListSignalsParams): Observable<DsaSignal[]> {
    let hp = new HttpParams();
    if (params.type) hp = hp.set('type', params.type);
    if (params.category) hp = hp.set('category', params.category);
    if (params.since) hp = hp.set('since', String(params.since));
    if (params.limit) hp = hp.set('limit', String(params.limit));
    if (params.offset) hp = hp.set('offset', String(params.offset));
    if (params.q) hp = hp.set('q', params.q);

    return this.http.get<DsaSignal[]>(`${this.baseUrl}/signals`, { params: hp })
      .pipe(catchError(err => {
        this.snack.open('Could not load signals.', 'OK', { duration: 3000 });
        return of([]);
      }));
  }

  getSignalById(id: string): Observable<DsaSignal> {
    return this.http.get<DsaSignal>(`${this.baseUrl}/signals/${id}`)
      .pipe(catchError(err => {
        this.snack.open('Could not load signal detail.', 'OK', { duration: 3000 });
        throw err;
      }));
  }

  promoteSignal(id: string): Observable<PromoteResult> {
    return this.http.post<PromoteResult>(`${this.baseUrl}/signals/${id}/promote`, {})
      .pipe(catchError(err => {
        this.snack.open('Could not promote signal to notice.', 'OK', { duration: 3000 });
        throw err;
      }));
  }

  deleteSignal(id: string, reason?: string) {
    return this.http.delete<{ deleted: boolean }>(
      `${this.baseUrl}/signals/${id}`,
      { body: reason ? { reason } : undefined }
    ).pipe(
      catchError(err => {
        this.snack.open('Could not delete signal.', 'OK', { duration: 3000 });
        throw err;
      })
    );
  }

  // dsa.service.ts (in der Klasse DsaService ergänzen)
  createDecision(
    noticeId: string,
    payload: {
      outcome: 'REMOVE_CONTENT' | 'RESTRICT' | 'NO_ACTION' | 'FORWARD_TO_AUTHORITY';
      legalBasis: string | null;
      tosBasis: string | null;
      automatedUsed: boolean;
      statement: string | null;
    }
  ) {
    return this.http.post<{ id: string }>(`${this.baseUrl}/notices/${noticeId}/decision`, payload)
      .pipe(
        catchError(err => {
          this.snack.open('Could not create decision.', 'OK', { duration: 3000 });
          throw err;
        })
      );
  }

  /** Get all evidence entries for a given notice */
  getEvidenceForNotice(noticeId: string) {
    return this.http.get<DsaEvidence[]>(`${this.baseUrl}/notices/${noticeId}/evidence`)
      .pipe(
        catchError(err => {
          this.snack.open('Could not load evidence.', 'OK', { duration: 3000 });
          return of([]);
        })
      );
  }

  /** Add new evidence entry to a notice */
  addEvidence(noticeId: string, data: { type: string; url?: string | null; hash?: string | null }) {
    return this.http.post<{ id: string }>(`${this.baseUrl}/notices/${noticeId}/evidence`, data)
      .pipe(
        catchError(err => {
          this.snack.open('Could not add evidence.', 'OK', { duration: 3000 });
          throw err;
        })
      );
  }

}