import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { StickerService } from '../../../services/sticker.service';

@Component({
  selector: 'app-protected-sticker-image',
  imports: [MatIconModule],
  templateUrl: './protected-sticker-image.component.html',
  styleUrl: './protected-sticker-image.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProtectedStickerImageComponent implements OnChanges, OnDestroy {
  @Input() stickerId: string | null | undefined;
  @Input() alt = '';

  readonly protectionOverlayUrl = 'assets/images/sticker-protection-overlay.svg';
  imageUrl = '';
  loading = false;
  failed = false;

  private readonly stickerService = inject(StickerService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private requestToken = 0;
  private objectUrl: string | null = null;

  ngOnChanges(): void {
    void this.loadSticker();
  }

  ngOnDestroy(): void {
    this.requestToken += 1;
    this.clearObjectUrl();
  }

  onImageLoaded(): void {
    this.loading = false;
    this.changeDetectorRef.markForCheck();
    this.revokeLoadedObjectUrl();
  }

  onImageError(): void {
    this.loading = false;
    this.failed = true;
    this.imageUrl = '';
    this.clearObjectUrl();
    this.changeDetectorRef.markForCheck();
  }

  private async loadSticker(): Promise<void> {
    const stickerId = this.stickerId?.trim();
    const requestToken = ++this.requestToken;
    this.clearObjectUrl();
    this.imageUrl = '';
    this.failed = false;
    this.loading = !!stickerId;
    this.changeDetectorRef.markForCheck();

    if (!stickerId) {
      return;
    }

    const objectUrl = await this.stickerService.fetchRenderObjectUrl(stickerId, 'preview');
    if (requestToken !== this.requestToken) {
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
      return;
    }

    if (!objectUrl) {
      this.loading = false;
      this.failed = true;
      this.changeDetectorRef.markForCheck();
      return;
    }

    this.objectUrl = objectUrl;
    this.imageUrl = objectUrl;
    this.changeDetectorRef.markForCheck();
  }

  private revokeLoadedObjectUrl(): void {
    if (!this.objectUrl) return;
    window.URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
  }

  private clearObjectUrl(): void {
    if (this.objectUrl) window.URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
  }
}
