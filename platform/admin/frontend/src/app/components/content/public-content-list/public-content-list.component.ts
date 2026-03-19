import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
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
import { debounceTime, distinctUntilChanged, finalize, map } from 'rxjs';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { PublicContentStatus } from '../../../interfaces/public-content-status.type';
import { PublicContentType } from '../../../interfaces/public-content-type.type';
import { PublicContent } from '../../../interfaces/public-content.interface';
import { PublicProfile } from '../../../interfaces/public-profile.interface';
import { AuthService } from '../../../services/auth/auth.service';
import { PublicContentService } from '../../../services/content/public-content.service';
import { PublicProfileService } from '../../../services/content/public-profile.service';

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

  readonly typeOptions: Array<PublicContentType | 'all'> = ['all', 'public', 'comment'];
  readonly statusOptions: Array<PublicContentStatus | 'all'> = ['all', 'draft', 'published', 'withdrawn', 'deleted'];

  readonly filterForm = this.fb.nonNullable.group({
    publicProfileId: this.fb.nonNullable.control(''),
    contentType: this.fb.nonNullable.control<PublicContentType | 'all'>('all'),
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
      contentType: this.filterForm.controls.contentType.value,
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

  openContent(row: PublicContent): void {
    this.router.navigate(['/dashboard/content', row.id, 'edit']);
  }

  createComment(row: PublicContent, event?: Event): void {
    event?.stopPropagation();
    this.router.navigate(['/dashboard/content/create'], {
      queryParams: {
        type: 'comment',
        parentId: row.id
      }
    });
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
    return row.contentType === 'public' && row.status === 'published';
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
    return row.publicProfile?.name?.trim() || 'No profile assigned';
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
    return profile?.name?.trim() || 'All profiles';
  }

  filterProfileAvatar(profile: PublicProfile | null): string {
    return profile?.avatarImage?.trim() || '';
  }

  filterProfileInitials(profile: PublicProfile | null): string {
    const name = this.filterProfileName(profile);
    const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
    return parts.map((part) => part.charAt(0).toUpperCase()).join('') || 'P';
  }

  tileTitle(row: PublicContent): string {
    if (row.contentType === 'comment' && row.parentContent) {
      const parentProfile = row.parentContent.publicProfileName?.trim();
      const parentLocation = row.parentContent.locationLabel?.trim();
      if (parentProfile && parentLocation) {
        return `${parentProfile} • ${parentLocation}`;
      }
      if (parentLocation) {
        return parentLocation;
      }
      if (parentProfile) {
        return parentProfile;
      }
      return 'Comment';
    }

    const locationLabel = row.location?.label?.trim();
    if (locationLabel) {
      return locationLabel;
    }

    const mediaTitle = row.multimedia?.title?.trim();
    if (mediaTitle) {
      return mediaTitle;
    }

    return 'Public message';
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
      return `Attached media: ${this.mediaTypeLabel(row.multimedia.type)}`;
    }

    return 'No text content.';
  }

  locationLabel(row: PublicContent): string {
    if (row.contentType === 'comment') {
      const parentProfile = row.parentContent?.publicProfileName?.trim();
      const parentLocation = row.parentContent?.locationLabel?.trim();
      if (parentProfile && parentLocation) {
        return `Reply to ${parentProfile} • ${parentLocation}`;
      }
      if (parentLocation) {
        return `Reply to ${parentLocation}`;
      }
      if (parentProfile) {
        return `Reply to ${parentProfile}`;
      }
      return 'Comment without parent';
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

    return 'No location';
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
        return 'Tenor GIF';
      case 'image':
        return 'Image';
      case 'undefined':
      case '':
        return 'No media';
      default:
        return type ?? 'Media';
    }
  }

  tileAvatarIcon(row: PublicContent): string {
    switch (row.status) {
      case 'published':
        return 'campaign';
      case 'withdrawn':
        return 'unpublished';
      case 'deleted':
        return 'delete_outline';
      case 'draft':
      default:
        return row.multimedia?.type && row.multimedia.type !== 'undefined' ? 'perm_media' : 'edit_note';
    }
  }

  tileAvatarClass(row: PublicContent): string {
    switch (row.status) {
      case 'published':
        return 'avatar avatar-success';
      case 'withdrawn':
        return 'avatar avatar-warn';
      case 'deleted':
        return 'avatar avatar-neutral';
      case 'draft':
      default:
        return 'avatar avatar-accent';
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
        return 'Published';
      case 'withdrawn':
        return 'Withdrawn';
      case 'deleted':
        return 'Deleted';
      case 'draft':
      default:
        return 'Draft';
    }
  }

  typeLabel(type: PublicContentType | string): string {
    return type === 'comment' ? 'Comment' : 'Message';
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
