import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, forkJoin, map, Observable, of, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';

import { DsaSignal } from '../../../interfaces/dsa-signal.interface';
import { ListSignalsParams } from '../../../interfaces/list-signals-params.interface';
import { NoticeStats } from '../../../interfaces/notice-stats.interface';
import { PromoteResult } from '../../../interfaces/promote-result.interface';
import { SignalStats } from '../../../interfaces/signal-stats.interface';
import { AppealStats } from '../../../interfaces/appeal-stats.interface';

import { DsaAuditEntry } from '../../../interfaces/dsa-audit-entry.interface';
import { DsaDecision } from '../../../interfaces/dsa-decision.interface';
import { DsaEvidence } from '../../../interfaces/dsa-evidence.interface';
import { DsaNoticeFilters } from '../../../interfaces/dsa-notice-filters.interface';
import { DsaNoticeStatus } from '../../../interfaces/dsa-notice-status.type';
import { DsaNotice } from '../../../interfaces/dsa-notice.interface';
import { ListAuditParams } from '../../../interfaces/list-audit-params.interface';
import { TransparencyStats } from '../../../interfaces/transparency-stats.interface';
import { TransparencyReport } from '../../../interfaces/transparency-report.interface';
import { DsaAppeal } from '../../../interfaces/dsa-appeal.interface';
import { ListAppealsParams } from '../../../interfaces/list-appeals-params.interface';
import { DsaNotification, ListNotificationsParams, NotificationMeta, NotificationPayload } from '../../../interfaces/dsa-notification.interface';
import { DsaTextBlock, DsaTextBlockFilters, DsaTextBlockSavePayload, DsaTextBlockTranslationPreview } from '../../../interfaces/dsa-text-block.interface';
import { PlatformUserModerationOpenAppealsResponse, PlatformUserModerationResponse, PlatformUserModerationAppeal } from '../../../interfaces/platform-user-moderation.interface';
import { TranslationHelperService } from '../../translation-helper.service';
import { DisplayMessageService } from '../../display-message.service';

@Injectable({ providedIn: 'root' })
export class DsaService {
  private readonly baseUrl = `${environment.apiUrl}/dsa/backend`;
  private readonly publicBaseUrl = `${environment.apiUrl}/public`;
  private readonly userBaseUrl = `${environment.apiUrl}/user`;

  /** Dashboard-Stats-Loading */
  readonly loading = signal(false);
  readonly noticeStats = signal<NoticeStats | null>(null);
  readonly signalStats = signal<SignalStats | null>(null);
  readonly appealStats = signal<AppealStats | null>(null);
  readonly openUserModerationAppeals = signal<PlatformUserModerationAppeal[]>([]);
  readonly openUserModerationAppealsCount = signal(0);
  private readonly http = inject(HttpClient);
  private readonly snack = inject(DisplayMessageService);
  private readonly i18n = inject(TranslationHelperService);

  private openSnack(message: string, duration = 3000): void {
    this.snack.open(this.i18n.t(message), this.i18n.t('OK'), { duration });
  }

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
      catchError(() => {
        this.openSnack('Could not load notices.', 3000);
        return of([]);
      })
    );
  }

  downloadEvidence(evidenceId: string): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.baseUrl}/evidence/${evidenceId}/download`, {
      observe: 'response',
      responseType: 'blob'
    } as const).pipe(
      catchError(err => {
        this.openSnack('Could not download evidence.', 3000);
        return throwError(() => err);
      })
    );
  }

  getTransparencyStats(range: string): Observable<TransparencyStats> {
    const params = new HttpParams().set('range', range);
    return this.http.get<TransparencyStats>(`${this.publicBaseUrl}/transparency/stats`, { params }).pipe(
      catchError(err => {
        this.openSnack('Could not load transparency stats.', 3000);
        throw err;
      })
    );
  }

  listTransparencyReports(range: string): Observable<TransparencyReport[]> {
    const params = new HttpParams().set('range', range);
    return this.http.get<TransparencyReport[]>(`${this.publicBaseUrl}/transparency/reports`, { params }).pipe(
      catchError(() => {
        this.openSnack('Could not load transparency reports.', 3000);
        return of([]);
      })
    );
  }

  downloadTransparencyReport(id: string): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.publicBaseUrl}/transparency/reports/${id}/download`, {
      observe: 'response',
      responseType: 'blob'
    } as const).pipe(
      catchError(err => {
        this.openSnack('Could not download report.', 3000);
        return throwError(() => err);
      })
    );
  }

  /** Einzelabruf einer Notice */
  getNoticeById(id: string): Observable<DsaNotice> {
    return this.http.get<DsaNotice>(`${this.baseUrl}/notices/${id}`).pipe(
      catchError(err => {
        this.openSnack('Could not load notice.', 3000);
        throw err;
      })
    );
  }

  /** Status einer Notice ändern (PATCH /notices/:id/status) */
  patchNoticeStatus(id: string, status: DsaNoticeStatus): Observable<{ ok: boolean }> {
    return this.http.patch<{ ok: boolean }>(`${this.baseUrl}/notices/${id}/status`, { status }).pipe(
      catchError(err => {
        this.openSnack('Could not update notice status.', 3000);
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
        catchError(() => {
          this.openSnack('Could not load notice stats.', 3000);
          this.loading.set(false);
          return of(null);
        })
      )
      .subscribe(res => {
        if (res) this.noticeStats.set(res);
        this.loading.set(false);
      });
  }

  loadAppealStats(): void {
    this.loading.set(true);
    this.http.get<AppealStats>(`${this.baseUrl}/stats/appeals`)
      .pipe(
        catchError(() => {
          this.openSnack('Could not load appeal stats.', 3000);
          this.loading.set(false);
          return of(null);
        })
      )
      .subscribe(res => {
        if (res) this.appealStats.set(res);
        this.loading.set(false);
      });
  }

  /* =======================
   *  NOTIFICATIONS
   * ======================= */

  listNotifications(params: ListNotificationsParams = {}): Observable<DsaNotification[]> {
    let httpParams = new HttpParams()
      .set('limit', String(params.limit ?? 200))
      .set('offset', String(params.offset ?? 0));
    if (params.noticeId) httpParams = httpParams.set('noticeId', params.noticeId);
    if (params.decisionId) httpParams = httpParams.set('decisionId', params.decisionId);
    if (params.stakeholder) httpParams = httpParams.set('stakeholder', params.stakeholder);
    if (params.channel) httpParams = httpParams.set('channel', params.channel);
    if (params.q) httpParams = httpParams.set('q', params.q);

    return this.http.get<DsaNotification[]>(`${this.baseUrl}/notifications`, { params: httpParams }).pipe(
      catchError(() => {
        this.openSnack('Could not load notifications.', 3000);
        return of([]);
      })
    );
  }

  getNotificationById(id: string): Observable<DsaNotification> {
    return this.http.get<DsaNotification>(`${this.baseUrl}/notifications/${encodeURIComponent(id)}`).pipe(
      catchError(err => {
        this.openSnack('Could not load notification.', 3000);
        throw err;
      })
    );
  }

  resendNotification(id: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.baseUrl}/notifications/${encodeURIComponent(id)}/resend`, {}).pipe(
      catchError(err => {
        const msg = err?.error?.error === 'resend_not_supported'
          ? 'Resending is not supported for this channel.'
          : 'Could not resend notification.';
        this.openSnack(msg);
        throw err;
      })
    );
  }

  exportNotifications(params: ListNotificationsParams = {}): Observable<Blob> {
    let httpParams = new HttpParams()
      .set('format', 'csv')
      .set('limit', String(params.limit ?? 500))
      .set('offset', String(params.offset ?? 0));
    if (params.noticeId) httpParams = httpParams.set('noticeId', params.noticeId);
    if (params.decisionId) httpParams = httpParams.set('decisionId', params.decisionId);
    if (params.stakeholder) httpParams = httpParams.set('stakeholder', params.stakeholder);
    if (params.channel) httpParams = httpParams.set('channel', params.channel);
    if (params.q) httpParams = httpParams.set('q', params.q);

    return this.http.get(`${this.baseUrl}/notifications`, {
      params: httpParams,
      responseType: 'blob'
    }).pipe(
      catchError(err => {
        this.openSnack('Could not export notifications.', 3000);
        throw err;
      })
    );
  }

  createNotification(payload: {
    noticeId?: string | null;
    decisionId?: string | null;
    stakeholder: string;
    channel: string;
    payload: NotificationPayload;
    meta?: NotificationMeta;
  }): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.baseUrl}/notifications`, payload).pipe(
      catchError(err => {
        this.openSnack('Could not create notification.', 3000);
        throw err;
      })
    );
  }

  loadSignalStats(): void {
    this.loading.set(true);
    this.http.get<SignalStats>(`${this.baseUrl}/stats/signals`)
      .pipe(
        catchError(() => {
          this.openSnack('Could not load signal stats.', 3000);
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
        .pipe(catchError(() => of(null))),
      appeals: this.http.get<AppealStats>(`${this.baseUrl}/stats/appeals`)
        .pipe(catchError(() => of(null))),
      userModerationAppeals: this.http.get<PlatformUserModerationOpenAppealsResponse>(`${this.userBaseUrl}/platform/appeals/open?limit=25`)
        .pipe(catchError(() => of(null)))
    }).subscribe(({ notices, signals, appeals, userModerationAppeals }) => {
      if (notices) this.noticeStats.set(notices);
      if (signals) this.signalStats.set(signals);
      if (appeals) this.appealStats.set(appeals);
      if (userModerationAppeals) {
        this.openUserModerationAppeals.set(userModerationAppeals.appeals || []);
        this.openUserModerationAppealsCount.set(Number(userModerationAppeals.totalOpen || 0));
      }
      if (!notices || !signals || !appeals || !userModerationAppeals) {
        this.openSnack('Some DSA stats could not be loaded.', 3000);
      }
      this.loading.set(false);
    });
  }

  /* =======================
   *  SIGNALS (bestehend)
   * ======================= */

  listSignals(params: ListSignalsParams): Observable<DsaSignal[]> {
    let hp = new HttpParams();
    if (params.status) hp = hp.set('status', params.status);
    if (params.type) hp = hp.set('type', params.type);
    if (params.category) hp = hp.set('category', params.category);
    if (params.since) hp = hp.set('since', String(params.since));
    if (params.limit) hp = hp.set('limit', String(params.limit));
    if (params.offset) hp = hp.set('offset', String(params.offset));
    if (params.q) hp = hp.set('q', params.q);

    return this.http.get<DsaSignal[]>(`${this.baseUrl}/signals`, { params: hp })
      .pipe(catchError(() => {
        this.openSnack('Could not load signals.', 3000);
        return of([]);
      }));
  }

  listAppeals(params: ListAppealsParams = {}): Observable<DsaAppeal[]> {
    let hp = new HttpParams();
    if (params.status) hp = hp.set('status', params.status);
    if (params.noticeId) hp = hp.set('noticeId', params.noticeId);
    if (params.outcome) hp = hp.set('outcome', params.outcome);
    if (typeof params.limit === 'number') hp = hp.set('limit', String(params.limit));
    if (typeof params.offset === 'number') hp = hp.set('offset', String(params.offset));

    return this.http.get<DsaAppeal[]>(`${this.baseUrl}/appeals`, { params: hp }).pipe(
      catchError(() => {
        this.openSnack('Could not load appeals.', 3000);
        return of([]);
      })
    );
  }

  resolveAppeal(appealId: string, payload: { outcome: string | null; reviewer?: string | null; reason?: string | null }) {
    return this.http.patch<{ ok: boolean }>(`${this.baseUrl}/appeals/${encodeURIComponent(appealId)}/resolution`, payload)
      .pipe(
        catchError(err => {
          this.openSnack('Could not update appeal.', 3000);
          throw err;
        })
      );
  }

  getSignalById(id: string): Observable<DsaSignal> {
    return this.http.get<DsaSignal>(`${this.baseUrl}/signals/${id}`)
      .pipe(catchError(err => {
        this.openSnack('Could not load signal detail.', 3000);
        throw err;
      }));
  }

  promoteSignal(id: string): Observable<PromoteResult> {
    return this.http.post<PromoteResult>(`${this.baseUrl}/signals/${id}/promote`, {})
      .pipe(catchError(err => {
        this.openSnack('Could not promote signal to notice.', 3000);
        throw err;
      }));
  }

  deleteSignal(id: string, reason?: string) {
    return this.http.delete<{ deleted: boolean }>(
      `${this.baseUrl}/signals/${id}`,
      { body: reason ? { reason } : undefined }
    ).pipe(
      catchError(err => {
        this.openSnack('Could not delete signal.', 3000);
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
      legalBasisEn?: string | null;
      tosBasis: string | null;
      tosBasisEn?: string | null;
      automatedUsed: boolean;
      statement: string | null;
      statementEn?: string | null;
    }
  ) {
    return this.http.post<{ id: string }>(`${this.baseUrl}/notices/${noticeId}/decision`, payload)
      .pipe(
        catchError(err => {
          this.openSnack('Could not create decision.', 3000);
          throw err;
        })
      );
  }


  listDecisionTextBlocks(filters: DsaTextBlockFilters = {}): Observable<DsaTextBlock[]> {
    let params = new HttpParams();
    if (filters.type) params = params.set('type', filters.type);
    if (filters.q?.trim()) params = params.set('q', filters.q.trim());
    if (typeof filters.activeOnly === 'boolean') params = params.set('activeOnly', String(filters.activeOnly));

    return this.http.get<DsaTextBlock[]>(`${this.baseUrl}/text-blocks`, { params }).pipe(
      catchError(() => {
        this.openSnack('Could not load DSA text blocks.', 3000);
        return of([]);
      })
    );
  }

  createDecisionTextBlock(payload: DsaTextBlockSavePayload): Observable<DsaTextBlock> {
    return this.http.post<DsaTextBlock>(`${this.baseUrl}/text-blocks`, payload).pipe(
      catchError(err => {
        this.openSnack('Could not create DSA text block.', 3000);
        throw err;
      })
    );
  }

  updateDecisionTextBlock(id: string, payload: Partial<DsaTextBlockSavePayload>): Observable<DsaTextBlock> {
    return this.http.patch<DsaTextBlock>(`${this.baseUrl}/text-blocks/${encodeURIComponent(id)}`, payload).pipe(
      catchError(err => {
        this.openSnack('Could not save DSA text block.', 3000);
        throw err;
      })
    );
  }

  deleteDecisionTextBlock(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/text-blocks/${encodeURIComponent(id)}`).pipe(
      catchError(err => {
        this.openSnack('Could not delete DSA text block.', 3000);
        throw err;
      })
    );
  }

  translateDecisionTextBlockPreview(payload: Pick<DsaTextBlockSavePayload, 'labelDe' | 'descriptionDe' | 'contentDe'>): Observable<DsaTextBlockTranslationPreview> {
    return this.http.post<DsaTextBlockTranslationPreview>(`${this.baseUrl}/text-blocks/translate-preview`, payload).pipe(
      catchError(err => {
        this.openSnack('Could not translate DSA text block.', 3000);
        throw err;
      })
    );
  }

  setPublicMessageVisibility(contentId: string, visible: boolean) {
    const trimmed = contentId?.trim();
    if (!trimmed) return of({ status: 0 });

    return this.http.post<{
      ok: boolean;
      status: number;
      visible: boolean;
      contentId: string;
      messageUuid: string;
      messageId: number | null;
    }>(`${this.baseUrl}/publicmessage/visibility`, {
      contentId: trimmed,
      visible
    }).pipe(
      catchError(err => {
        this.openSnack('Could not update message visibility.', 3000);
        throw err;
      })
    );
  }

  /** Get all evidence entries for a given notice */
  getEvidenceForNotice(noticeId: string) {
    return this.http.get<DsaEvidence[]>(`${this.baseUrl}/notices/${noticeId}/evidence`)
      .pipe(
        catchError(() => {
          this.openSnack('Could not load evidence.', 3000);
          return of([]);
        })
      );
  }

  /** Add new evidence entry to a notice */
  addEvidence(
    noticeId: string,
    data: { type: 'url' | 'hash' | 'file'; url?: string | null; hash?: string | null; file?: File | null }
  ) {
    if (data.type === 'file') {
      if (!data.file) {
        return throwError(() => new Error('file_required'));
      }
      const form = new FormData();
      form.append('type', 'file');
      form.append('file', data.file);
      if (data.hash) form.append('hash', data.hash);
      return this.http.post<{ id: string }>(`${this.baseUrl}/notices/${noticeId}/evidence`, form)
        .pipe(
          catchError(err => {
            this.openSnack('Could not add evidence.', 3000);
            throw err;
          })
        );
    }

    const body = {
      type: data.type,
      url: data.url ?? null,
      hash: data.hash ?? null
    };

    return this.http.post<{ id: string }>(`${this.baseUrl}/notices/${noticeId}/evidence`, body)
      .pipe(
        catchError(err => {
          this.openSnack('Could not add evidence.', 3000);
          throw err;
        })
      );
  }

  /** Capture server-side screenshot and attach as file evidence */
  addEvidenceScreenshot(
    noticeId: string,
    payload: { url: string; fullPage?: boolean; viewport?: { width?: number; height?: number } }
  ) {
    return this.http.post<{ id: string }>(`${this.baseUrl}/notices/${noticeId}/evidence/screenshot`, payload)
      .pipe(
        catchError(err => {
          const msg = err?.error?.error === 'screenshot_unavailable'
            ? 'Screenshot service not available on server.'
            : 'Could not create screenshot evidence.';
          this.openSnack(msg);
          throw err;
        })
      );
  }

  getDecisionForNotice(noticeId: string) {
    return this.http.get<DsaDecision | null>(`${this.baseUrl}/notices/${noticeId}/decision`);
  }

  getNoticeStatusUrl(noticeId: string) {
    return this.http.get<{ statusUrl: string }>(`${this.baseUrl}/notices/${noticeId}/status-url`).pipe(
      catchError(err => {
        this.openSnack('Status page not available.', 2000);
        throw err;
      })
    );
  }

  getSignalStatusUrl(signalId: string) {
    return this.http.get<{ statusUrl: string }>(`${this.baseUrl}/signals/${signalId}/status-url`).pipe(
      catchError(err => {
        this.openSnack('Status page not available.', 2000);
        throw err;
      })
    );
  }

  // Helper (z. B. oben in der Datei außerhalb der Klasse)
  safeParseDetails(input: unknown): Record<string, unknown> | null {
    if (!input) return null;
    if (typeof input === 'object') return input as Record<string, unknown>;
    if (typeof input === 'string') {
      try { return JSON.parse(input) as Record<string, unknown>; }
      catch { return { _raw: input }; }
    }
    return null;
  }

  // dsa.service.ts
  getAuditForNotice(noticeId: string): Observable<DsaAuditEntry[]> {
    return this.http.get<Record<string, unknown>[]>(`${this.baseUrl}/audit/notice/${noticeId}`).pipe(
      map(rows => (rows || []).map((e) => {
        const entry = e as Record<string, unknown>;
        return {
          id: String(entry['id']),
          entityType: String(entry['entityType']),
          entityId: String(entry['entityId']),
          action: String(entry['action']),
          actor: String(entry['actor']),
          createdAt: Number((entry['createdAt'] ?? entry['at'] ?? Date.now())),
          details: this.safeParseDetails(entry['details'] ?? entry['detailsJson'])
        } as DsaAuditEntry;
      })),
      catchError(() => {
        this.openSnack('Could not load audit log.', 3000);
        return of([]);
      })
    );
  }

  notifyStakeholder(noticeId: string, payload: {
    channel: string;
    subject: string;
    message: string;
    sendEmail?: boolean;
  }) {
    return this.http.post(`${this.baseUrl}/notices/${noticeId}/notify`, payload).pipe(
      catchError(err => {
        this.openSnack('Could not send notification.', 3000);
        throw err;
      })
    );
  }

  // services/dsa.service.ts
  listAudit(params: ListAuditParams) {
    let hp = new HttpParams();
    if (params.entityType) hp = hp.set('entityType', params.entityType);
    if (params.action) hp = hp.set('action', params.action);
    if (params.since) hp = hp.set('since', String(params.since));
    if (params.q) hp = hp.set('q', params.q);
    if (params.limit) hp = hp.set('limit', String(params.limit));
    if (params.offset) hp = hp.set('offset', String(params.offset));
    return this.http.get<DsaAuditEntry[]>(`${this.baseUrl}/audit`, { params: hp })
      .pipe(
        catchError(() => {
          this.openSnack('Could not load audit log.', 3000);
          return of([]);
        })
      );
  }

  getPlatformUserModeration(userId: string): Observable<PlatformUserModerationResponse> {
    return this.http.get<PlatformUserModerationResponse>(`${this.userBaseUrl}/platform/${encodeURIComponent(userId)}`).pipe(
      catchError(err => {
        this.openSnack('Could not load user moderation state.', 3000);
        throw err;
      })
    );
  }

  getOpenPlatformUserAppeals(limit = 100): Observable<PlatformUserModerationOpenAppealsResponse> {
    return this.http.get<PlatformUserModerationOpenAppealsResponse>(
      `${this.userBaseUrl}/platform/appeals/open?limit=${encodeURIComponent(String(limit))}`
    ).pipe(
      catchError(err => {
        this.openSnack('Could not load open user appeals.', 3000);
        throw err;
      })
    );
  }

  loadOpenPlatformUserAppeals(limit = 100): void {
    this.getOpenPlatformUserAppeals(limit).subscribe({
      next: (res) => {
        this.openUserModerationAppeals.set(res?.appeals || []);
        this.openUserModerationAppealsCount.set(Number(res?.totalOpen || 0));
      },
      error: () => undefined
    });
  }

  updatePlatformUserModeration(
    userId: string,
    payload: { target: 'posting' | 'account'; blocked: boolean; reason?: string | null; blockedUntil?: number | null; }
  ): Observable<PlatformUserModerationResponse> {
    return this.http.patch<PlatformUserModerationResponse>(
      `${this.userBaseUrl}/platform/${encodeURIComponent(userId)}/moderation`,
      payload
    ).pipe(
      catchError(err => {
        this.openSnack('Could not update user moderation state.', 3000);
        throw err;
      })
    );
  }

  resolvePlatformUserAppeal(
    appealId: string,
    payload: { status: 'accepted' | 'rejected'; resolutionMessage?: string | null; }
  ): Observable<PlatformUserModerationResponse> {
    return this.http.patch<PlatformUserModerationResponse>(
      `${this.userBaseUrl}/platform/appeals/${encodeURIComponent(appealId)}`,
      payload
    ).pipe(
      catchError(err => {
        this.openSnack('Could not update user appeal.', 3000);
        throw err;
      })
    );
  }

}
