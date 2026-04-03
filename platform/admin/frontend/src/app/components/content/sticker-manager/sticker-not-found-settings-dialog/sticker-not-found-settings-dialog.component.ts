import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { finalize } from 'rxjs';
import { StickerAdminService } from '../../../../services/content/sticker-admin.service';
import { DisplayMessageService } from '../../../../services/display-message.service';
import { TranslationHelperService } from '../../../../services/translation-helper.service';

@Component({
  selector: 'app-sticker-not-found-settings-dialog',
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule
  ],
  templateUrl: './sticker-not-found-settings-dialog.component.html',
  styleUrl: './sticker-not-found-settings-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StickerNotFoundSettingsDialogComponent {
  private previewAbortController: AbortController | null = null;
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject(MatDialogRef<StickerNotFoundSettingsDialogComponent>);
  private readonly stickerService = inject(StickerAdminService);
  private readonly snackBar = inject(DisplayMessageService);

  readonly i18n = inject(TranslationHelperService);
  readonly settings = this.stickerService.settings;
  readonly loadingPreview = signal(false);
  readonly uploadingAsset = signal(false);
  readonly uploadingLicense = signal(false);
  readonly previewUrl = signal('');

  constructor() {
    effect(() => {
      const assetPath = this.settings()?.notFoundAssetPath || '';
      if (!assetPath) {
        this.revokePreviewUrl();
        return;
      }
      void this.loadPreviewAsync();
    });

    this.destroyRef.onDestroy(() => {
      this.previewAbortController?.abort();
      this.revokePreviewUrl();
    });

    this.stickerService.loadSettings();
  }

  close(): void {
    this.dialogRef.close();
  }

  triggerAssetPicker(input: HTMLInputElement): void {
    input.value = '';
    input.click();
  }

  handleAssetSelection(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) {
      input.value = '';
      return;
    }
    if (!this.isSvgFile(file)) {
      this.showMessage('Please select an SVG file.', true);
      input.value = '';
      return;
    }

    this.uploadingAsset.set(true);
    this.stickerService.uploadNotFoundAsset(file).pipe(
      finalize(() => {
        this.uploadingAsset.set(false);
        input.value = '';
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.setPreviewUrl(window.URL.createObjectURL(file));
        this.showMessage('Not-found sticker SVG uploaded.');
      },
      error: () => undefined
    });
  }

  triggerLicensePicker(input: HTMLInputElement): void {
    input.value = '';
    input.click();
  }

  handleLicenseSelection(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) {
      input.value = '';
      return;
    }
    if (!this.isPdfFile(file)) {
      this.showMessage('Please select a PDF file.', true);
      input.value = '';
      return;
    }

    this.uploadingLicense.set(true);
    this.stickerService.uploadNotFoundLicense(file).pipe(
      finalize(() => {
        this.uploadingLicense.set(false);
        input.value = '';
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.showMessage('Not-found sticker license uploaded.');
      },
      error: () => undefined
    });
  }

  async openLicenseInNewTab(): Promise<void> {
    if (!this.settings()?.notFoundLicenseFilePath) {
      this.showMessage('No not-found license uploaded yet.', true);
      return;
    }

    const licenseTab = window.open('', '_blank');
    if (!licenseTab) {
      this.showMessage('Could not display not-found license.', true);
      return;
    }

    const objectUrl = await this.stickerService.fetchNotFoundLicenseUrl();
    if (!objectUrl) {
      licenseTab.close();
      this.showMessage('Could not display not-found license.', true);
      return;
    }

    licenseTab.location.replace(objectUrl);
    licenseTab.focus();
    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60000);
  }

  private async loadPreviewAsync(): Promise<void> {
    this.previewAbortController?.abort();
    this.previewAbortController = new AbortController();
    const abortController = this.previewAbortController;
    this.loadingPreview.set(true);

    try {
      const nextUrl = await this.stickerService.fetchNotFoundAssetUrl(abortController.signal);
      if (abortController.signal.aborted) {
        if (nextUrl) {
          window.URL.revokeObjectURL(nextUrl);
        }
        return;
      }
      if (nextUrl) {
        this.setPreviewUrl(nextUrl);
      }
    } finally {
      if (this.previewAbortController === abortController) {
        this.previewAbortController = null;
      }
      this.loadingPreview.set(false);
    }
  }

  private revokePreviewUrl(): void {
    const current = this.previewUrl();
    if (current) {
      window.URL.revokeObjectURL(current);
    }
    this.previewUrl.set('');
  }

  private setPreviewUrl(nextUrl: string): void {
    const current = this.previewUrl();
    if (current && current !== nextUrl) {
      window.URL.revokeObjectURL(current);
    }
    this.previewUrl.set(nextUrl);
  }

  private isSvgFile(file: File): boolean {
    return file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
  }

  private isPdfFile(file: File): boolean {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  }

  private showMessage(message: string, isError = false): void {
    this.snackBar.open(this.i18n.t(message), this.i18n.t('OK'), {
      duration: 3000,
      panelClass: [isError ? 'snack-error' : 'snack-success'],
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
  }
}
