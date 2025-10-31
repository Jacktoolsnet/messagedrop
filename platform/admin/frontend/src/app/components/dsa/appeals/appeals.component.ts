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
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
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
  private readonly sanitizer = inject(DomSanitizer);

  readonly loading = signal(false);
  readonly appeals = signal<DsaAppeal[]>([]);
  readonly statusFilter = signal<AppealStatusFilter>('open');
  readonly selectedAppeal = signal<DsaAppeal | null>(null);
  readonly selectedNotice = signal<DsaNotice | null>(null);
  readonly rightLoading = signal(false);
  makingScreenshot = signal(false);

  // Parsed content of selected notice
  contentObj = signal<any | null>(null);
  mediaKind = signal<'iframe' | 'image' | 'none'>('none');
  embedUrl = signal<SafeResourceUrl | null>(null);
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
      next: (rows: DsaAppeal[]) => this.appeals.set(rows ?? []),
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
            this.dsa.setPublicMessageVisibility(cid, visible).subscribe({ next: () => { }, error: () => { } });
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
              // rechte Seite aktualisieren
              if (this.selectedAppeal()?.id === appeal.id) {
                this.selectAppeal(appeal);
              }
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
  private safeParse(json: string | null | undefined): any {
    if (!json) return null;
    try { return JSON.parse(json); } catch { return null; }
  }

  hasExternalLink(): boolean {
    const n = this.selectedNotice();
    const c = this.contentObj();
    return !!(n?.contentUrl || c?.multimedia?.sourceUrl);
  }

  externalLink(): string | null {
    const n = this.selectedNotice();
    const c = this.contentObj();
    return n?.contentUrl || c?.multimedia?.sourceUrl || null;
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
    const type = (mm?.type || '').toLowerCase();
    if (!type) { this.mediaKind.set('none'); return; }

    if (type === 'youtube') {
      const id = this.getYouTubeId(mm);
      if (id) {
        this.embedUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${id}`));
        this.mediaKind.set('iframe');
      }
      return;
    }

    if (type === 'spotify') {
      const url = this.buildSpotifyEmbed(mm);
      if (url) {
        this.embedUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
        this.mediaKind.set('iframe');
      }
      return;
    }

    if (type === 'tiktok') {
      const id = this.getTikTokId(mm);
      if (id) {
        this.embedUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.tiktok.com/embed/v2/${id}`));
        this.mediaKind.set('iframe');
      }
      return;
    }

    if (type === 'tenor' || type === 'image') {
      const url = mm?.url || mm?.sourceUrl;
      if (url) {
        this.imageUrl.set(url);
        this.mediaKind.set('image');
      }
      return;
    }
  }

  private getYouTubeId(mm: any): string | null {
    if (mm?.contentId) return String(mm.contentId).split('?')[0];
    const html: string | undefined = mm?.oembed?.html;
    if (html) {
      const m = html.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
      if (m?.[1]) return m[1];
    }
    const src = String(mm?.sourceUrl || mm?.url || '');
    const watch = src.match(/[?&]v=([a-zA-Z0-9_-]+)/);
    if (watch?.[1]) return watch[1];
    const shorts = src.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/);
    if (shorts?.[1]) return shorts[1];
    const embed = src.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
    if (embed?.[1]) return embed[1];
    return null;
  }

  private buildSpotifyEmbed(mm: any): string | null {
    if (mm?.contentId) return `https://open.spotify.com/embed/${mm.contentId}`;
    const src: string | undefined = mm?.sourceUrl || mm?.url;
    if (!src) return null;
    if (src.includes('open.spotify.com')) {
      return src.replace('open.spotify.com/', 'open.spotify.com/embed/');
    }
    return null;
  }

  private getTikTokId(mm: any): string | null {
    const src = String(mm?.sourceUrl || mm?.url || '');
    const m = src.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/);
    if (m?.[1]) return m[1];
    return mm?.contentId || null;
  }
}
