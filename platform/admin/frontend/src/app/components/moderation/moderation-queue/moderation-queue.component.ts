import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin, of, switchMap } from 'rxjs';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { ModerationDetailsDialogComponent } from './moderation-details-dialog.component';
import { ModerationRequest } from '../../../interfaces/moderation-request.interface';
import { ModerationService } from '../../../services/moderation.service';
import { TranslateService } from '../../../services/translate-service/translate-service.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { DisplayMessageService } from '../../../services/display-message.service';

@Component({
  selector: 'app-moderation-queue',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatProgressBarModule,
    MatFormFieldModule,
    MatSelectModule
  ],
  templateUrl: './moderation-queue.component.html',
  styleUrls: ['./moderation-queue.component.css']
})
export class ModerationQueueComponent implements OnInit {
  private readonly moderationService = inject(ModerationService);
  private readonly snack = inject(DisplayMessageService);
  private readonly translator = inject(TranslateService);
  private readonly dialog = inject(MatDialog);
  private readonly sanitizer = inject(DomSanitizer);
  readonly i18n = inject(TranslationHelperService);

  readonly loading = signal(false);
  readonly actionLoading = signal(false);
  readonly translateLoading = signal(false);
  readonly requests = signal<ModerationRequest[]>([]);
  readonly selected = signal<ModerationRequest | null>(null);
  readonly translatedText = signal<string>('');
  readonly mode = signal<'queue' | 'voluntary'>('queue');
  readonly voluntaryLastSeenAt = signal(0);
  readonly voluntaryUpdatedAt = signal(0);
  readonly voluntaryLoadedMaxTimestamp = signal(0);
  readonly voluntaryReviewedMaxTimestamp = signal(0);

  rejectionReason = '';

  readonly reasons = [
    'Hate speech or harassment',
    'Violence or threats',
    'Sexual content',
    'Illegal activity',
    'Spam or scams',
    'Privacy or personal data',
    'Copyright infringement',
    'Other Terms of Use violation'
  ];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    const activeMode = this.mode();
    const request = activeMode === 'queue'
      ? this.moderationService.listRequests('pending', 200, 0)
      : this.moderationService.listVoluntary(500);

    request.subscribe({
      next: (res) => {
        const rows = (res.rows ?? []).map((row) => ({
          ...row,
          source: activeMode
        } satisfies ModerationRequest));
        this.requests.set(rows);
        this.selected.set(null);
        this.translatedText.set('');
        this.rejectionReason = '';
        if (activeMode === 'voluntary') {
          const state = (res as { state?: { lastSeenAt: number; updatedAt: number } }).state;
          this.voluntaryLastSeenAt.set(Number(state?.lastSeenAt || 0));
          this.voluntaryUpdatedAt.set(Number(state?.updatedAt || 0));
          this.voluntaryLoadedMaxTimestamp.set(this.maxMessageTimestamp(rows));
          this.voluntaryReviewedMaxTimestamp.set(0);
        } else {
          this.voluntaryLoadedMaxTimestamp.set(0);
          this.voluntaryReviewedMaxTimestamp.set(0);
        }
        if (rows.length) {
          this.select(rows[0]);
        }
      },
      error: () => {
        this.snack.open(this.i18n.t('Could not load moderation requests.'), this.i18n.t('OK'), { duration: 3000 });
      },
      complete: () => this.loading.set(false)
    });
  }

  setMode(mode: 'queue' | 'voluntary'): void {
    if (this.mode() === mode) {
      return;
    }
    this.mode.set(mode);
    this.requests.set([]);
    this.selected.set(null);
    this.voluntaryLoadedMaxTimestamp.set(0);
    this.voluntaryReviewedMaxTimestamp.set(0);
    this.load();
  }

  isQueueMode(): boolean {
    return this.mode() === 'queue';
  }

  isVoluntaryMode(): boolean {
    return this.mode() === 'voluntary';
  }

  newestLoadedMessageTimestamp(): number {
    return this.isVoluntaryMode()
      ? this.voluntaryLoadedMaxTimestamp()
      : this.maxMessageTimestamp(this.requests());
  }

  finishVoluntaryMode(): void {
    const lastSeenAt = this.newestLoadedMessageTimestamp();
    if (!lastSeenAt) {
      this.snack.open(this.i18n.t('No loaded messages to mark as reviewed.'), this.i18n.t('OK'), { duration: 3000 });
      return;
    }

    const openMessages = [...this.requests()];
    if (openMessages.length > 0) {
      this.dialog.open(ConfirmDialogComponent, {
        data: {
          title: 'Mark remaining messages as OK?',
          message: 'Do you want to mark all currently open voluntary moderation messages as OK before finishing?',
          confirmText: 'Yes',
          cancelText: 'No'
        },
        maxWidth: '420px',
        autoFocus: false
      }).afterClosed().subscribe((markAllOk) => {
        this.finishVoluntaryModeAfterConfirmation(
          this.resolveVoluntaryFinishTimestamp(markAllOk === true, openMessages),
          markAllOk === true ? openMessages : []
        );
      });
      return;
    }

    this.finishVoluntaryModeAfterConfirmation(this.voluntaryReviewedMaxTimestamp() || lastSeenAt, []);
  }

  private finishVoluntaryModeAfterConfirmation(lastSeenAt: number, messagesToApprove: ModerationRequest[]): void {
    if (!lastSeenAt || lastSeenAt <= this.voluntaryLastSeenAt()) {
      this.snack.open(this.i18n.t('Voluntary moderation checkpoint unchanged.'), undefined, { duration: 2200 });
      this.setMode('queue');
      return;
    }

    this.actionLoading.set(true);
    const approveRequests = messagesToApprove.map((message) => this.moderationService.approveMessage(message.messageUuid));
    const approve$ = approveRequests.length > 0 ? forkJoin(approveRequests) : of([]);

    approve$.pipe(
      switchMap((approveResults) => {
        const failed = approveResults.some((result) => !result.approved);
        if (failed) {
          throw new Error('bulk_approval_failed');
        }
        return this.moderationService.finishVoluntary(lastSeenAt);
      }),
      finalize(() => this.actionLoading.set(false))
    ).subscribe({
      next: (res) => {
        if (res.finished) {
          this.voluntaryLastSeenAt.set(Number(res.state?.lastSeenAt || lastSeenAt));
          this.voluntaryUpdatedAt.set(Number(res.state?.updatedAt || 0));
          this.requests.set([]);
          this.selected.set(null);
          const message = messagesToApprove.length > 0
            ? 'Open messages marked as OK and voluntary moderation checkpoint saved.'
            : 'Voluntary moderation checkpoint saved.';
          this.snack.open(this.i18n.t(message), undefined, { duration: 2500 });
          this.setMode('queue');
        } else {
          this.snack.open(this.i18n.t('Could not save voluntary moderation checkpoint.'), this.i18n.t('OK'), { duration: 3000 });
        }
      },
      error: () => this.snack.open(this.i18n.t('Could not finish voluntary moderation.'), this.i18n.t('OK'), { duration: 3000 })
    });
  }

  private resolveVoluntaryFinishTimestamp(markAllOpenAsOk: boolean, openMessages: ModerationRequest[]): number {
    if (markAllOpenAsOk) {
      return this.voluntaryLoadedMaxTimestamp();
    }

    if (openMessages.length > 0) {
      const oldestOpenTimestamp = Math.min(
        ...openMessages
          .map((row) => Number(row.messageCreatedAt || row.createdAt || 0))
          .filter((value) => Number.isFinite(value) && value > 0)
      );
      if (Number.isFinite(oldestOpenTimestamp) && oldestOpenTimestamp > 0) {
        return Math.max(this.voluntaryLastSeenAt(), oldestOpenTimestamp - 1);
      }
    }

    return this.voluntaryReviewedMaxTimestamp();
  }

  select(entry: ModerationRequest): void {
    this.selected.set(entry);
    this.rejectionReason = this.suggestReason(entry);
    this.translatedText.set('');
  }

  isSelected(entry: ModerationRequest): boolean {
    return this.selected()?.id === entry.id;
  }

  trackById(_index: number, item: ModerationRequest): string {
    return item.id;
  }

  formatLocal(ts?: number | null): string {
    if (!ts) return '-';
    try {
      return new Date(ts).toLocaleString(this.i18n.dateLocale());
    } catch {
      return new Date(ts).toISOString();
    }
  }

  formatScore(score?: number | null): string {
    if (score === undefined || score === null) return '-';
    return Number(score).toFixed(3);
  }

  reactionCount(value?: number | null): number {
    return Math.max(0, Number(value || 0));
  }

  hasLocation(entry: ModerationRequest): boolean {
    return Number.isFinite(Number(entry.latitude)) && Number.isFinite(Number(entry.longitude))
      && (Number(entry.latitude) !== 0 || Number(entry.longitude) !== 0);
  }

  mapEmbedUrl(entry: ModerationRequest): SafeResourceUrl | null {
    if (!this.hasLocation(entry)) {
      return null;
    }
    const latitude = Number(entry.latitude);
    const longitude = Number(entry.longitude);
    const latitudeDelta = 0.006;
    const longitudeDelta = Math.max(0.006 / Math.cos((latitude * Math.PI) / 180), 0.006);
    const bbox = [
      Math.max(-180, longitude - longitudeDelta),
      Math.max(-85, latitude - latitudeDelta),
      Math.min(180, longitude + longitudeDelta),
      Math.min(85, latitude + latitudeDelta)
    ].join(',');
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${latitude},${longitude}`)}`
    );
  }

  openDetailsDialog(entry: ModerationRequest): void {
    this.dialog.open(ModerationDetailsDialogComponent, {
      data: { request: entry },
      maxWidth: '760px',
      width: 'min(760px, 94vw)',
      autoFocus: false
    });
  }

  boolLabel(value?: number | boolean | null): string {
    if (value === undefined || value === null) return '-';
    return value === true || value === 1 ? this.i18n.t('Yes') : this.i18n.t('No');
  }

  formattedAiResponse(value?: string | null): string {
    if (!value) return '-';
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }

  translateSelected(): void {
    const current = this.selected();
    const text = current?.messageText?.trim() ?? '';
    if (!text) {
      this.snack.open(this.i18n.t('No text to translate.'), this.i18n.t('OK'), { duration: 2000 });
      return;
    }
    this.translateLoading.set(true);
    this.translator.translateToGerman(text).subscribe({
      next: (result) => {
        this.translatedText.set(result || this.i18n.t('Translation failed.'));
      },
      error: () => {
        this.snack.open(this.i18n.t('Translation failed.'), this.i18n.t('OK'), { duration: 3000 });
      },
      complete: () => this.translateLoading.set(false)
    });
  }

  reasonLabel(reason: string): string {
    return this.i18n.t(reason);
  }

  private suggestReason(entry: ModerationRequest): string {
    if (entry.patternMatch === true || entry.patternMatch === 1) {
      return 'Privacy or personal data';
    }
    const category = this.extractTopCategory(entry.aiResponse);
    if (!category) return '';
    const key = category.toLowerCase();
    if (key.includes('hate') || key.includes('harassment')) return 'Hate speech or harassment';
    if (key.includes('violence')) return 'Violence or threats';
    if (key.includes('sexual')) return 'Sexual content';
    if (key.includes('illicit')) return 'Illegal activity';
    if (key.includes('spam') || key.includes('scam')) return 'Spam or scams';
    if (key.includes('privacy') || key.includes('personal')) return 'Privacy or personal data';
    if (key.includes('copyright') || key.includes('intellectual')) return 'Copyright infringement';
    if (key.includes('self-harm')) return 'Other Terms of Use violation';
    return 'Other Terms of Use violation';
  }

  private extractTopCategory(aiResponse?: string | null): string | null {
    if (!aiResponse) return null;
    try {
      const parsed = JSON.parse(aiResponse);
      const result = parsed?.results?.[0];
      const scores = result?.category_scores;
      if (scores && typeof scores === 'object') {
        let topKey = null;
        let topScore = -1;
        for (const [key, value] of Object.entries(scores)) {
          const numeric = Number(value);
          if (Number.isFinite(numeric) && numeric > topScore) {
            topScore = numeric;
            topKey = key;
          }
        }
        if (topKey) return topKey;
      }
      const categories = result?.categories;
      if (categories && typeof categories === 'object') {
        const flagged = Object.entries(categories).find(([, value]) => value === true);
        return flagged ? flagged[0] : null;
      }
      return null;
    } catch {
      return null;
    }
  }

  approveSelected(): void {
    const current = this.selected();
    if (!current) return;
    this.actionLoading.set(true);
    const request = this.isVoluntaryMode()
      ? this.moderationService.approveMessage(current.messageUuid)
      : this.moderationService.approveRequest(current.id);
    request.subscribe({
      next: (res) => {
        if (res.approved) {
          this.recordVoluntaryDecisionTimestamp(current);
          this.removeFromList(current.id);
          this.snack.open(this.i18n.t('Message approved.'), undefined, { duration: 2000 });
        } else {
          this.snack.open(this.i18n.t('Approval failed.'), this.i18n.t('OK'), { duration: 3000 });
        }
      },
      error: () => this.snack.open(this.i18n.t('Approval failed.'), this.i18n.t('OK'), { duration: 3000 }),
      complete: () => this.actionLoading.set(false)
    });
  }

  rejectSelected(): void {
    const current = this.selected();
    if (!current) return;
    if (!this.rejectionReason) {
      this.snack.open(this.i18n.t('Please select a rejection reason.'), this.i18n.t('OK'), { duration: 3000 });
      return;
    }
    this.actionLoading.set(true);
    const request = this.isVoluntaryMode()
      ? this.moderationService.rejectMessage(current.messageUuid, this.rejectionReason)
      : this.moderationService.rejectRequest(current.id, this.rejectionReason);
    request.subscribe({
      next: (res) => {
        if (res.rejected) {
          this.recordVoluntaryDecisionTimestamp(current);
          this.removeFromList(current.id);
          this.snack.open(this.i18n.t('Message rejected.'), undefined, { duration: 2000 });
        } else {
          this.snack.open(this.i18n.t('Rejection failed.'), this.i18n.t('OK'), { duration: 3000 });
        }
      },
      error: () => this.snack.open(this.i18n.t('Rejection failed.'), this.i18n.t('OK'), { duration: 3000 }),
      complete: () => this.actionLoading.set(false)
    });
  }

  private removeFromList(id: string): void {
    const updated = this.requests().filter(item => item.id !== id);
    this.requests.set(updated);
    this.selected.set(updated[0] ?? null);
    this.rejectionReason = '';
  }

  private maxMessageTimestamp(rows: ModerationRequest[]): number {
    return Math.max(0, ...rows.map((row) => Number(row.messageCreatedAt || row.createdAt || 0)));
  }

  private recordVoluntaryDecisionTimestamp(row: ModerationRequest): void {
    if (!this.isVoluntaryMode()) {
      return;
    }
    const timestamp = Number(row.messageCreatedAt || row.createdAt || 0);
    if (Number.isFinite(timestamp) && timestamp > 0) {
      this.voluntaryReviewedMaxTimestamp.set(Math.max(this.voluntaryReviewedMaxTimestamp(), timestamp));
    }
  }
}
