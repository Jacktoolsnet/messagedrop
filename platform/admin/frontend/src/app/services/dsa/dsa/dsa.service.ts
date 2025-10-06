import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, forkJoin, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { NoticeStats } from '../../../interfaces/notice-stats.interface';
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
}