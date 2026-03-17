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
import { debounceTime, distinctUntilChanged, finalize, map } from 'rxjs';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { PublicContentStatus } from '../../../interfaces/public-content-status.type';
import { PublicContent } from '../../../interfaces/public-content.interface';
import { AuthService } from '../../../services/auth/auth.service';
import { PublicContentService } from '../../../services/content/public-content.service';

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
    MatChipsModule
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

  readonly role = this.authService.role;
  readonly rows = this.publicContentService.rows;
  readonly loading = this.publicContentService.loading;
  readonly canPublish = computed(() => ['editor', 'admin', 'root'].includes(this.role() ?? ''));
  readonly canAccess = computed(() => ['author', 'editor', 'admin', 'root'].includes(this.role() ?? ''));

  readonly statusOptions: Array<PublicContentStatus | 'all'> = ['all', 'draft', 'published', 'withdrawn', 'deleted'];

  readonly filterForm = this.fb.nonNullable.group({
    status: this.fb.nonNullable.control<PublicContentStatus | 'all'>('all'),
    q: this.fb.nonNullable.control('')
  });

  constructor() {
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
      status: this.filterForm.controls.status.value,
      q: this.filterForm.controls.q.value,
      limit: 100,
      offset: 0
    });
  }

  createContent(): void {
    this.router.navigate(['/dashboard/content/create']);
  }

  openContent(row: PublicContent): void {
    this.router.navigate(['/dashboard/content', row.id, 'edit']);
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
}
