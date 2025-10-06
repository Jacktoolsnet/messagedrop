import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, forkJoin, Observable, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { DsaSignal } from '../../../interfaces/dsa-signal.interface';
import { ListSignalsParams } from '../../../interfaces/list-signals-params.interface';
import { NoticeStats } from '../../../interfaces/notice-stats.interface';
import { PromoteResult } from '../../../interfaces/promote-result.interface';
import { SignalStats } from '../../../interfaces/signal-stats.interface';

@Injectable({ providedIn: 'root' })
export class DsaService {
  private readonly baseUrl = `${environment.apiUrl}/dsa/backend`;

  /** Signals für das Dashboard */
  readonly loading = signal(false);
  readonly noticeStats = signal<NoticeStats | null>(null);
  readonly signalStats = signal<SignalStats | null>(null);

  constructor(
    private http: HttpClient,
    private snack: MatSnackBar
  ) { }

  /** Einzelabruf: Notices */
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

  /** Einzelabruf: Signals */
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

  /** Beide parallel laden (für Dashboard-Initialisierung) */
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
    // Angular v20 unterstützt body bei DELETE
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
}