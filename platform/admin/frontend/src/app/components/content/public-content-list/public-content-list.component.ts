import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, finalize, map } from 'rxjs';
import { PublicContentStatus } from '../../../interfaces/public-content-status.type';
import { PublicContentType } from '../../../interfaces/public-content-type.type';
import { PublicContent } from '../../../interfaces/public-content.interface';
import { PublicProfile } from '../../../interfaces/public-profile.interface';
import { AuthService } from '../../../services/auth/auth.service';
import { PublicContentService } from '../../../services/content/public-content.service';
import { PublicProfileService } from '../../../services/content/public-profile.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';

@Component({
  selector: 'app-public-content-list',
  imports: [
    CommonModule,
    DatePipe,
    RouterLink,
    ReactiveFormsModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatBadgeModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressBarModule,
    MatChipsModule,
    MatTooltipModule
  ],
  templateUrl: './public-content-list.component.html',
  styleUrls: ['./public-content-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PublicContentListComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly authService = inject(AuthService);
  private readonly publicContentService = inject(PublicContentService);
  private readonly publicProfileService = inject(PublicProfileService);

  readonly i18n = inject(TranslationHelperService);
  readonly role = this.authService.role;
  readonly rows = this.publicContentService.rows;
  readonly loading = this.publicContentService.loading;
  readonly profiles = this.publicProfileService.rows;
  readonly canPublish = computed(() => ['editor', 'admin', 'root'].includes(this.role() ?? ''));
  readonly canAccess = computed(() => ['author', 'editor', 'admin', 'root'].includes(this.role() ?? ''));
  readonly selectedProfile = computed(() => {
    const profileId = this.filterForm.controls.publicProfileId.value;
    if (!profileId) {
      return null;
    }
    return this.profiles().find((profile) => profile.id === profileId) ?? null;
  });

  readonly statusOptions: Array<PublicContentStatus | 'all'> = ['all', 'draft', 'published', 'withdrawn', 'deleted'];

  readonly filterForm = this.fb.nonNullable.group({
    publicProfileId: this.fb.nonNullable.control(''),
    status: this.fb.nonNullable.control<PublicContentStatus | 'all'>('all'),
    q: this.fb.nonNullable.control('')
  });

  constructor() {
    this.publicProfileService.loadProfiles();
    this.load();

    this.filterForm.valueChanges.pipe(
      debounceTime(250),
      map((value) => JSON.stringify(value)),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.load());
  }

  trackById(_index: number, row: PublicContent): string {
    return row.id;
  }

  load(): void {
    this.publicContentService.loadPublicContent({
      publicProfileId: this.filterForm.controls.publicProfileId.value,
      contentType: 'public',
      status: this.filterForm.controls.status.value,
      q: this.filterForm.controls.q.value,
      limit: 100,
      offset: 0
    });
  }

  createContent(): void {
    this.router.navigate(['/dashboard/content/create']);
  }

  openProfiles(): void {
    this.router.navigate(['/dashboard/content/profiles']);
  }

  openAiSettings(): void {
    this.router.navigate(['/dashboard/content/ai'], {
      queryParams: {
        returnTo: this.router.url
      }
    });
  }

  openContent(row: PublicContent): void {
    this.router.navigate(['/dashboard/content', row.id, 'edit']);
  }

  openComments(row: PublicContent, event?: Event): void {
    event?.stopPropagation();
    this.openContent(row);
  }

  canPublishRow(row: PublicContent): boolean {
    return this.canPublish() && row.status !== 'published' && row.status !== 'deleted';
  }

  canWithdrawRow(row: PublicContent): boolean {
    return row.status === 'published';
  }

  canDeleteRow(row: PublicContent): boolean {
    return row.status !== 'deleted';
  }

  canRestoreRow(row: PublicContent): boolean {
    return row.status === 'deleted';
  }

  canCommentOnRow(row: PublicContent): boolean {
    return row.status === 'published';
  }

  childCommentCount(row: PublicContent): number {
    return Math.max(0, Number(row.childCommentCount ?? 0));
  }

  hasImageMultimedia(row: PublicContent): boolean {
    const multimedia = row.multimedia;
    if (!multimedia?.url) {
      return false;
    }

    if (multimedia.type === 'image' || multimedia.type === 'tenor') {
      return true;
    }

    return /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(multimedia.url);
  }

  resolvedStyle(row: PublicContent): string {
    return row.style || row.publicProfile?.defaultStyle || '';
  }

  profileName(row: PublicContent): string {
    return row.publicProfile?.name?.trim() || this.i18n.t('No profile assigned');
  }

  profileAvatar(row: PublicContent): string {
    return row.publicProfile?.avatarImage?.trim() || '';
  }

  profileInitials(row: PublicContent): string {
    const name = this.profileName(row);
    const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
    return parts.map((part) => part.charAt(0).toUpperCase()).join('') || 'P';
  }

  filterProfileName(profile: PublicProfile | null): string {
    return profile?.name?.trim() || this.i18n.t('All profiles');
  }

  filterProfileAvatar(profile: PublicProfile | null): string {
    return profile?.avatarImage?.trim() || '';
  }

  filterProfileInitials(profile: PublicProfile | null): string {
    const name = this.filterProfileName(profile);
    const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
    return parts.map((part) => part.charAt(0).toUpperCase()).join('') || 'P';
  }

  tilePreview(row: PublicContent): string {
    const message = row.message?.trim();
    if (message) {
      return message;
    }

    const mediaTitle = row.multimedia?.title?.trim();
    if (mediaTitle) {
      return mediaTitle;
    }

    const mediaDescription = row.multimedia?.description?.trim();
    if (mediaDescription) {
      return mediaDescription;
    }

    if (row.multimedia?.type && row.multimedia.type !== 'undefined') {
      return this.i18n.t('Attached media: {{type}}', { type: this.mediaTypeLabel(row.multimedia.type) });
    }

    return this.i18n.t('No text content.');
  }

  locationLabel(row: PublicContent): string {
    if (row.contentType === 'comment') {
      const parentProfile = row.parentContent?.publicProfileName?.trim();
      const parentLocation = row.parentContent?.locationLabel?.trim();
      if (parentProfile && parentLocation) {
        return this.i18n.t('Reply to {{label}}', { label: `${parentProfile} • ${parentLocation}` });
      }
      if (parentLocation) {
        return this.i18n.t('Reply to {{label}}', { label: parentLocation });
      }
      if (parentProfile) {
        return this.i18n.t('Reply to {{label}}', { label: parentProfile });
      }
      return this.i18n.t('Comment without parent');
    }

    const label = this.normalizeLocationLabel(row.location?.label?.trim() ?? '');
    if (label) {
      return label;
    }

    const plusCode = row.location?.plusCode?.trim();
    if (plusCode) {
      return plusCode;
    }

    const latitude = Number(row.location?.latitude ?? 0);
    const longitude = Number(row.location?.longitude ?? 0);
    if (latitude !== 0 || longitude !== 0) {
      return `${this.formatCoordinate(latitude)}, ${this.formatCoordinate(longitude)}`;
    }

    return this.i18n.t('No location');
  }

  mediaTypeLabel(type: string | null | undefined): string {
    switch ((type ?? '').toLowerCase()) {
      case 'youtube':
        return 'YouTube';
      case 'spotify':
        return 'Spotify';
      case 'pinterest':
        return 'Pinterest';
      case 'tiktok':
        return 'TikTok';
      case 'tenor':
        return this.i18n.t('Tenor GIF');
      case 'image':
        return this.i18n.t('Image');
      case 'undefined':
      case '':
        return this.i18n.t('No media');
      default:
        return type ?? this.i18n.t('Media');
    }
  }

  statusIcon(status: string): string {
    switch (status) {
      case 'published':
        return 'campaign';
      case 'withdrawn':
        return 'unpublished';
      case 'deleted':
        return 'delete_outline';
      case 'draft':
      default:
        return 'edit_note';
    }
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'published':
        return this.i18n.t('Published');
      case 'withdrawn':
        return this.i18n.t('Withdrawn');
      case 'deleted':
        return this.i18n.t('Deleted');
      case 'draft':
      default:
        return this.i18n.t('Draft');
    }
  }

  typeLabel(type: PublicContentType | string): string {
    return type === 'comment' ? this.i18n.t('Comment') : this.i18n.t('Public message');
  }

  typeIcon(type: PublicContentType | string): string {
    return type === 'comment' ? 'forum' : 'campaign';
  }

  statusClass(status: string): string {
    switch (status) {
      case 'published':
        return 'status-published';
      case 'withdrawn':
        return 'status-withdrawn';
      case 'deleted':
        return 'status-deleted';
      case 'draft':
      default:
        return 'status-draft';
    }
  }

  private formatCoordinate(value: number): string {
    return value.toFixed(4).replace(/\.?0+$/, '');
  }

  private normalizeLocationLabel(value: string): string {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return '';
    }

    const firstSegment = normalized.split(',')[0]?.trim();
    return firstSegment || normalized;
  }

  confirmPublish(row: PublicContent, event?: Event): void {
    event?.stopPropagation();
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Publish message?',
        message: 'The current draft will be published to the public backend.',
        confirmText: 'Publish',
        cancelText: 'Cancel'
      }
    }).afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.publicContentService.publishPublicContent(row.id)
          .pipe(
            finalize(() => this.load()),
            takeUntilDestroyed(this.destroyRef)
          )
          .subscribe({ error: () => undefined });
      });
  }

  confirmWithdraw(row: PublicContent, event?: Event): void {
    event?.stopPropagation();
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Withdraw publication?',
        message: 'The public message will be removed from the public backend.',
        confirmText: 'Withdraw',
        cancelText: 'Cancel',
        warn: true
      }
    }).afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.publicContentService.withdrawPublicContent(row.id)
          .pipe(
            finalize(() => this.load()),
            takeUntilDestroyed(this.destroyRef)
          )
          .subscribe({ error: () => undefined });
      });
  }

  confirmDelete(row: PublicContent, event?: Event): void {
    event?.stopPropagation();
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete content?',
        message: 'This content entry will be deleted permanently.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        warn: true
      }
    }).afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.publicContentService.deletePublicContent(row.id)
          .pipe(
            finalize(() => this.load()),
            takeUntilDestroyed(this.destroyRef)
          )
          .subscribe({ error: () => undefined });
      });
  }

  confirmRestore(row: PublicContent, event?: Event): void {
    event?.stopPropagation();
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Restore content?',
        message: 'The deleted message will be restored and moved back to draft.',
        confirmText: 'Restore',
        cancelText: 'Cancel'
      }
    }).afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.publicContentService.restorePublicContent(row.id)
          .pipe(
            finalize(() => this.load()),
            takeUntilDestroyed(this.destroyRef)
          )
          .subscribe({ error: () => undefined });
      });
  }
}
