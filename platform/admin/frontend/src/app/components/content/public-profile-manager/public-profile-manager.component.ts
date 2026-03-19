import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { finalize } from 'rxjs';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { PublicProfile } from '../../../interfaces/public-profile.interface';
import { ContentStyleOption, ContentStyleService } from '../../../services/content/content-style.service';
import { PublicProfileService } from '../../../services/content/public-profile.service';

@Component({
  selector: 'app-public-profile-manager',
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule
  ],
  templateUrl: './public-profile-manager.component.html',
  styleUrls: ['./public-profile-manager.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PublicProfileManagerComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly publicProfileService = inject(PublicProfileService);
  private readonly styleService = inject(ContentStyleService);

  readonly rows = this.publicProfileService.rows;
  readonly loading = this.publicProfileService.loading;
  readonly styleOptions = this.styleService.getStyleOptions();
  readonly saving = signal(false);
  readonly selectedProfileId = signal<string | null>(null);
  readonly isCreatingNew = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: this.fb.nonNullable.control('', { validators: [Validators.required] }),
    avatarImage: this.fb.nonNullable.control(''),
    defaultStyle: this.fb.nonNullable.control(this.styleOptions[0]?.style ?? '', { validators: [Validators.required] })
  });

  readonly selectedProfile = computed(() => {
    const selectedId = this.selectedProfileId();
    return this.rows().find((row) => row.id === selectedId) ?? null;
  });
  readonly selectedStyleOption = computed<ContentStyleOption | null>(() => (
    this.styleService.findOptionByStyle(this.form.controls.defaultStyle.value)
  ));
  readonly avatarPreview = computed(() => this.form.controls.avatarImage.value.trim());
  readonly profileInitials = computed(() => this.buildInitials(this.form.controls.name.value));

  constructor() {
    effect(() => {
      const rows = this.rows();
      const isLoading = this.loading();
      const isCreatingNew = this.isCreatingNew();
      const selectedId = this.selectedProfileId();

      if (isLoading) {
        return;
      }

      if (rows.length === 0) {
        if (!isCreatingNew) {
          this.startNewProfile(false);
        }
        return;
      }

      if (isCreatingNew) {
        return;
      }

      if (selectedId && rows.some((row) => row.id === selectedId)) {
        return;
      }

      this.selectProfile(rows[0]);
    }, { allowSignalWrites: true });

    this.publicProfileService.loadProfiles();
  }

  trackById(_index: number, row: PublicProfile): string {
    return row.id;
  }

  trackStyleOption(_index: number, option: ContentStyleOption): string {
    return option.fontFamily;
  }

  goBack(): void {
    this.router.navigate(['/dashboard/content']);
  }

  startNewProfile(markCreating = true): void {
    this.isCreatingNew.set(markCreating);
    this.selectedProfileId.set(null);
    this.form.reset({
      name: '',
      avatarImage: '',
      defaultStyle: this.styleOptions[0]?.style ?? ''
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  selectProfile(row: PublicProfile): void {
    this.isCreatingNew.set(false);
    this.selectedProfileId.set(row.id);
    this.form.setValue({
      name: row.name ?? '',
      avatarImage: row.avatarImage ?? '',
      defaultStyle: this.styleService.normalizeStyle(row.defaultStyle) || (this.styleOptions[0]?.style ?? '')
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  saveProfile(): void {
    if (this.saving()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload = {
      name: raw.name.trim(),
      avatarImage: raw.avatarImage.trim(),
      defaultStyle: this.styleService.normalizeStyle(raw.defaultStyle)
    };

    if (!payload.name || !payload.defaultStyle) {
      this.form.markAllAsTouched();
      return;
    }

    const isNewProfile = this.isCreatingNew() || !this.selectedProfileId();
    this.saving.set(true);
    const request$ = isNewProfile
      ? this.publicProfileService.createProfile(payload)
      : this.publicProfileService.updateProfile(this.selectedProfileId()!, payload);

    request$.pipe(
      finalize(() => this.saving.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (row) => {
        this.isCreatingNew.set(false);
        this.selectedProfileId.set(row.id);
        this.selectProfile(row);
        this.publicProfileService.loadProfiles();
        this.showMessage(isNewProfile ? 'Public profile created.' : 'Public profile saved.');
      },
      error: () => undefined
    });
  }

  confirmDeleteSelected(): void {
    const profile = this.selectedProfile();
    if (!profile || this.saving()) {
      return;
    }

    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete public profile?',
        message: 'The profile will be removed. This only works if it is not assigned to any public message.',
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

        this.saving.set(true);
        this.publicProfileService.deleteProfile(profile.id).pipe(
          finalize(() => this.saving.set(false)),
          takeUntilDestroyed(this.destroyRef)
        ).subscribe({
          next: () => {
            this.showMessage('Public profile deleted.');
            this.startNewProfile(false);
            this.publicProfileService.loadProfiles();
          },
          error: () => undefined
        });
      });
  }

  triggerAvatarPicker(input: HTMLInputElement): void {
    input.click();
  }

  handleAvatarSelection(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.showMessage('Please choose an image file for the profile avatar.');
      input.value = '';
      return;
    }
    if (file.size > 1_500_000) {
      this.showMessage('Please use an avatar image smaller than 1.5 MB.');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      this.form.controls.avatarImage.setValue(result);
      this.form.controls.avatarImage.markAsDirty();
    };
    reader.onerror = () => this.showMessage('The avatar image could not be read.');
    reader.readAsDataURL(file);
    input.value = '';
  }

  removeAvatar(): void {
    this.form.controls.avatarImage.setValue('');
    this.form.controls.avatarImage.markAsDirty();
  }

  private buildInitials(name: string | null | undefined): string {
    const normalized = String(name || '').trim();
    if (!normalized) {
      return 'P';
    }

    const parts = normalized.split(/\s+/).slice(0, 2);
    return parts.map((part) => part.charAt(0).toUpperCase()).join('') || 'P';
  }

  private showMessage(message: string): void {
    this.snackBar.open(message, 'OK', { duration: 2600 });
  }
}
