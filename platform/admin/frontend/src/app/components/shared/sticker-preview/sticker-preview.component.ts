import { ChangeDetectionStrategy, Component, computed, effect, inject, input, OnDestroy, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { StickerAdminService } from '../../../services/content/sticker-admin.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';

interface StickerPreviewMultimedia {
  type?: string | null;
  contentId?: string | null;
  sourceUrl?: string | null;
  url?: string | null;
  title?: string | null;
}

@Component({
  selector: 'app-sticker-preview',
  imports: [
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './sticker-preview.component.html',
  styleUrl: './sticker-preview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StickerPreviewComponent implements OnDestroy {
  readonly multimedia = input.required<StickerPreviewMultimedia>();
  readonly alt = input('');

  readonly stickerProtectionOverlayUrl = 'images/sticker-protection-overlay.svg';
  readonly renderableImageUrl = signal('');
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly imageAlt = computed(() => this.alt().trim() || this.multimedia().title?.trim() || this.i18n.t('Selected multimedia preview'));

  private readonly stickerService = inject(StickerAdminService);
  private readonly i18n = inject(TranslationHelperService);
  private requestToken = 0;
  private currentRenderKey = '';
  private objectUrl: string | null = null;

  constructor() {
    effect(() => {
      const multimedia = this.multimedia();
      void this.updateImage(multimedia);
    });
  }

  ngOnDestroy(): void {
    this.requestToken += 1;
    this.currentRenderKey = '';
    this.clearObjectUrl();
  }

  markLoaded(): void {
    this.loading.set(false);
    this.revokeObjectUrl();
  }

  markError(): void {
    this.loading.set(false);
    this.error.set(true);
    this.currentRenderKey = '';
    this.renderableImageUrl.set('');
    this.clearObjectUrl();
  }

  private async updateImage(multimedia: StickerPreviewMultimedia): Promise<void> {
    const stickerId = this.stickerService.resolveStickerId(multimedia);
    if (!stickerId) {
      this.currentRenderKey = '';
      this.loading.set(false);
      this.error.set(true);
      this.renderableImageUrl.set('');
      this.clearObjectUrl();
      return;
    }

    const renderKey = `${stickerId}:preview`;
    if (renderKey === this.currentRenderKey && (this.renderableImageUrl() || this.loading())) {
      return;
    }

    this.currentRenderKey = renderKey;
    const requestToken = ++this.requestToken;
    this.loading.set(true);
    this.error.set(false);
    this.clearObjectUrl();
    this.renderableImageUrl.set('');

    const objectUrl = await this.stickerService.fetchRenderObjectUrl(stickerId);
    if (requestToken !== this.requestToken) {
      if (objectUrl) {
        window.URL.revokeObjectURL(objectUrl);
      }
      return;
    }

    if (!objectUrl) {
      this.loading.set(false);
      this.error.set(true);
      this.currentRenderKey = '';
      return;
    }

    this.objectUrl = objectUrl;
    this.renderableImageUrl.set(objectUrl);
  }

  private clearObjectUrl(): void {
    if (!this.objectUrl) {
      return;
    }

    window.URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
  }

  private revokeObjectUrl(): void {
    if (!this.objectUrl) {
      return;
    }

    window.URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
  }
}
