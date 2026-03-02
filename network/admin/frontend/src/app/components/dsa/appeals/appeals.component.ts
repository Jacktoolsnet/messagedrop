import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { RouterLink } from '@angular/router';

import { DsaAppeal } from '../../../interfaces/dsa-appeal.interface';
import { DsaNotice } from '../../../interfaces/dsa-notice.interface';
import { DsaService } from '../../../services/dsa/dsa/dsa.service';
import { AuthService } from '../../../services/auth/auth.service';
import { EvidenceListComponent } from '../notice/evidence/evidence-list/evidence-list.component';
import { DecisionSummaryComponent } from '../decisions/decision-summary/decision-summary.component';
import { NoticeAppealsComponent } from '../notice/appeals/notice-appeals.component';
import { AppealResolutionData, AppealResolutionDialogComponent } from './appeal-resolution-dialog/appeal-resolution-dialog.component';
import { DecisionDialogComponent, DecisionDialogResult } from '../decisions/decision-dialog/decision-dialog.component';
import { ReportedContentPayload, ReportedMultimedia } from '../../../interfaces/reported-content.interface';

type AppealStatusFilter = 'open' | 'resolved' | 'all';

@Component({
  selector: 'app-appeals',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    RouterLink,
    MatToolbarModule,
    MatMenuModule,
    MatIconModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatProgressBarModule,
    MatChipsModule,
    MatTooltipModule,
    MatDividerModule,
    EvidenceListComponent,
    DecisionSummaryComponent,
    NoticeAppealsComponent
  ],
  templateUrl: './appeals.component.html',
  styleUrls: ['./appeals.component.css']
})
export class AppealsComponent implements OnInit {
  private readonly dsa = inject(DsaService);
  private readonly snack = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(AuthService);

  readonly loading = signal(false);
  readonly appeals = signal<DsaAppeal[]>([]);
  readonly statusFilter = signal<AppealStatusFilter>('open');
  readonly selectedAppeal = signal<DsaAppeal | null>(null);
  readonly selectedNotice = signal<DsaNotice | null>(null);
  readonly rightLoading = signal(false);
  makingScreenshot = signal(false);

  // Parsed content of selected notice
  contentObj = signal<ReportedContentPayload | null>(null);
  mediaKind = signal<'iframe' | 'image' | 'none'>('none');
  embedUrl = signal<string | null>(null);
  imageUrl = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
    this.dsa.loadAppealStats();
  }

  setStatus(status: AppealStatusFilter | null): void {
    if (!status) return;
    if (this.statusFilter() === status) return;
    this.statusFilter.set(status);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.dsa.listAppeals({ status: this.statusFilter() }).subscribe({
      next: (rows: DsaAppeal[]) => {
        const list = rows ?? [];
        this.appeals.set(list);
        this.ensureSelectionIsValid(list);
      },
      error: () => this.snack.open('Could not load appeals.', 'OK', { duration: 3000 }),
      complete: () => this.loading.set(false)
    });
  }

  refresh(): void {
    this.load();
  }

  isOpen(appeal: DsaAppeal): boolean {
    return !appeal.resolvedAt;
  }

  selectAppeal(appeal: DsaAppeal): void {
    this.selectedAppeal.set(appeal);
    this.rightLoading.set(true);
    this.dsa.getNoticeById(appeal.noticeId).subscribe({
      next: (notice: DsaNotice) => {
        this.selectedNotice.set(notice);
        this.contentObj.set(this.safeParse(notice.reportedContent));
        this.updateMediaFromContent();
      },
      error: () => this.snack.open('Could not load notice detail.', 'OK', { duration: 3000 }),
      complete: () => this.rightLoading.set(false)
    });
  }

  resolveAppeal(appeal: DsaAppeal): void {
    const ref = this.dialog.open(AppealResolutionDialogComponent, {
      maxWidth: '95vw',
      maxHeight: '90vh',
      autoFocus: false,
      data: {
        defaultOutcome: appeal.outcome ?? 'UPHELD',
        reviewer: appeal.reviewer || this.auth.username() || undefined
      }
    });

    ref.afterClosed().subscribe((result: AppealResolutionData | null) => {
      if (!result) return;
      if (result.outcome === 'REVISED') {
        const dref = this.dialog.open<DecisionDialogComponent, { noticeId: string }, DecisionDialogResult | false>(DecisionDialogComponent, {
          data: { noticeId: appeal.noticeId },
          width: 'min(700px, 96vw)',
          maxHeight: '90vh',
          panelClass: 'md-dialog-rounded'
        });

        dref.afterClosed().subscribe((dec) => {
          if (!dec || !dec.saved) return;
          // Sichtbarkeit setzen entsprechend Outcome
          const cid = (appeal.noticeContentId || '').trim();
          if (cid) {
            const visible = dec.outcome === 'NO_ACTION';
            this.dsa.setPublicMessageVisibility(cid, visible).subscribe({
              error: () => this.snack.open('Could not update public visibility.', 'OK', { duration: 3000 })
            });
          }
          // Appeal als REVISED auflösen
          this.dsa.resolveAppeal(appeal.id, {
            outcome: 'REVISED',
            reviewer: result.reviewer || null,
            reason: result.reason || null
          }).subscribe({
            next: () => {
              this.snack.open('Appeal resolved and decision revised.', 'OK', { duration: 2000 });
              this.load();
              this.dsa.loadAppealStats();
            },
            error: () => this.snack.open('Could not update appeal.', 'OK', { duration: 3000 })
          });
        });
      } else {
        this.dsa.resolveAppeal(appeal.id, result).subscribe({
          next: () => {
            this.snack.open('Appeal updated.', 'OK', { duration: 2000 });
            this.load();
            this.dsa.loadAppealStats();
          },
          error: () => this.snack.open('Could not update appeal.', 'OK', { duration: 3000 })
        });
      }
    });
  }

  outcomeLabel(appeal: DsaAppeal): string {
    if (!appeal.outcome) return 'Pending';
    return appeal.outcome.replace(/_/g, ' ').toLowerCase();
  }

  trackById(_index: number, appeal: DsaAppeal) {
    return appeal.id;
  }

  isSelected(a: DsaAppeal): boolean {
    return this.selectedAppeal()?.id === a.id;
  }

  // Helpers
  private safeParse(json: string | null | undefined): ReportedContentPayload | null {
    if (!json) return null;
    try {
      const parsed = JSON.parse(json) as unknown;
      return parsed && typeof parsed === 'object' ? parsed as ReportedContentPayload : null;
    } catch {
      return null;
    }
  }

  hasExternalLink(): boolean {
    const n = this.selectedNotice();
    const c = this.contentObj();
    return !!this.toSafeHttpUrl(n?.contentUrl || c?.multimedia?.sourceUrl);
  }

  externalLink(): string | null {
    const n = this.selectedNotice();
    const c = this.contentObj();
    return this.toSafeHttpUrl(n?.contentUrl || c?.multimedia?.sourceUrl);
  }

  addScreenshotEvidence(): void {
    const n = this.selectedNotice();
    const url = this.externalLink();
    if (!n || !url || this.makingScreenshot()) return;
    this.makingScreenshot.set(true);
    this.dsa.addEvidenceScreenshot(n.id, { url, fullPage: true, viewport: { width: 1280, height: 800 } })
      .subscribe({
        next: () => {
          this.makingScreenshot.set(false);
          this.snack.open('Screenshot added as evidence.', 'OK', { duration: 2000 });
        },
        error: () => this.makingScreenshot.set(false)
      });
  }

  private updateMediaFromContent(): void {
    const c = this.contentObj();
    this.embedUrl.set(null);
    this.imageUrl.set(null);
    this.mediaKind.set('none');
    const mm = c?.multimedia;
    const type = (mm?.type ?? '').toLowerCase();
    if (!type) { this.mediaKind.set('none'); return; }

    if (type === 'youtube') {
      const id = this.getYouTubeId(mm);
      if (id) {
        this.embedUrl.set(`https://www.youtube.com/embed/${id}`);
        this.mediaKind.set('iframe');
      }
      return;
    }

    if (type === 'spotify') {
      const url = this.buildSpotifyEmbed(mm);
      if (url) {
        this.embedUrl.set(url);
        this.mediaKind.set('iframe');
      }
      return;
    }

    if (type === 'tiktok') {
      const id = this.getTikTokId(mm);
      if (id) {
        this.embedUrl.set(`https://www.tiktok.com/embed/v2/${id}`);
        this.mediaKind.set('iframe');
      }
      return;
    }

    if (type === 'tenor' || type === 'image') {
      const url = this.toSafeHttpUrl(mm?.url || mm?.sourceUrl);
      if (url) {
        this.imageUrl.set(url);
        this.mediaKind.set('image');
      }
      return;
    }
  }

  private isAllowedHost(host: string, allowedHosts: string[]): boolean {
    const normalized = host.toLowerCase();
    return allowedHosts.some((allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`));
  }

  private toSafeHttpUrl(value?: string | null): string | null {
    if (typeof value !== 'string' || !value.trim()) {
      return null;
    }
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
      }
      return parsed.toString();
    } catch {
      return null;
    }
  }

  private sanitizeYoutubeId(value?: string | null): string | null {
    if (!value) return null;
    const cleaned = value.trim();
    return /^[a-zA-Z0-9_-]{6,20}$/.test(cleaned) ? cleaned : null;
  }

  private sanitizeTikTokId(value?: string | null): string | null {
    if (!value) return null;
    const cleaned = value.trim();
    return /^\d{6,32}$/.test(cleaned) ? cleaned : null;
  }

  private getYouTubeId(mm: ReportedMultimedia | null | undefined): string | null {
    const fromContent = this.sanitizeYoutubeId(String(mm?.contentId || '').split('?')[0]);
    if (fromContent) return fromContent;

    const sourceUrl = this.toSafeHttpUrl(mm?.sourceUrl || mm?.url);
    if (!sourceUrl) return null;

    try {
      const parsed = new URL(sourceUrl);
      if (!this.isAllowedHost(parsed.hostname, ['youtube.com', 'youtu.be'])) {
        return null;
      }

      if (this.isAllowedHost(parsed.hostname, ['youtu.be'])) {
        const id = parsed.pathname.split('/').filter(Boolean)[0];
        return this.sanitizeYoutubeId(id);
      }

      const queryId = parsed.searchParams.get('v');
      const safeQueryId = this.sanitizeYoutubeId(queryId);
      if (safeQueryId) return safeQueryId;

      const segments = parsed.pathname.split('/').filter(Boolean);
      if (segments.length >= 2 && (segments[0] === 'shorts' || segments[0] === 'embed')) {
        return this.sanitizeYoutubeId(segments[1]);
      }
    } catch {
      return null;
    }
    return null;
  }

  private buildSpotifyEmbed(mm: ReportedMultimedia | null | undefined): string | null {
    const allowedTypes = new Set(['track', 'album', 'playlist', 'episode', 'show']);

    const fromContent = typeof mm?.contentId === 'string' ? mm.contentId.trim().replace(/^\/+/, '') : '';
    if (fromContent) {
      const parts = fromContent.split('/').filter(Boolean);
      if (parts.length === 2 && allowedTypes.has(parts[0]) && /^[a-zA-Z0-9]+$/.test(parts[1])) {
        return `https://open.spotify.com/embed/${parts[0]}/${parts[1]}`;
      }
    }

    const sourceUrl = this.toSafeHttpUrl(mm?.sourceUrl || mm?.url);
    if (!sourceUrl) return null;

    try {
      const parsed = new URL(sourceUrl);
      if (!this.isAllowedHost(parsed.hostname, ['open.spotify.com'])) {
        return null;
      }
      const segments = parsed.pathname.split('/').filter(Boolean);
      const startIndex = segments[0] === 'embed' ? 1 : 0;
      const type = segments[startIndex];
      const id = segments[startIndex + 1];
      if (!type || !id || !allowedTypes.has(type) || !/^[a-zA-Z0-9]+$/.test(id)) {
        return null;
      }
      return `https://open.spotify.com/embed/${type}/${id}`;
    } catch {
      return null;
    }
  }

  private getTikTokId(mm: ReportedMultimedia | null | undefined): string | null {
    const sourceUrl = this.toSafeHttpUrl(mm?.sourceUrl || mm?.url);
    if (sourceUrl) {
      try {
        const parsed = new URL(sourceUrl);
        if (this.isAllowedHost(parsed.hostname, ['tiktok.com', 'vm.tiktok.com'])) {
          const match = parsed.pathname.match(/\/@[^/]+\/video\/(\d+)/);
          const safeMatch = this.sanitizeTikTokId(match?.[1] || null);
          if (safeMatch) return safeMatch;
        }
      } catch {
        // ignore
      }
    }
    return this.sanitizeTikTokId(mm?.contentId || null);
  }

  private ensureSelectionIsValid(list: DsaAppeal[]): void {
    const currentId = this.selectedAppeal()?.id;
    if (!currentId) return;
    const stillExists = list.some(item => item.id === currentId);
    if (!stillExists) {
      this.clearSelection();
    }
  }

  private clearSelection(): void {
    this.selectedAppeal.set(null);
    this.selectedNotice.set(null);
    this.contentObj.set(null);
    this.mediaKind.set('none');
    this.embedUrl.set(null);
    this.imageUrl.set(null);
    this.rightLoading.set(false);
  }
}
