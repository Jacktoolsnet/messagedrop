import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogActions, MatDialogClose, MatDialogContent } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';
import { ExperienceBookmarkService } from '../../services/experience-bookmark.service';
import { ViatorService } from '../../services/viator.service';
import { ExperienceResult, ViatorProductDetail } from '../../interfaces/viator';
import { MatDialog } from '@angular/material/dialog';
import { ExperienceSearchDetailDialogComponent } from '../utils/experience-search/detail-dialog/experience-search-detail-dialog.component';

@Component({
  selector: 'app-my-experienceslist',
  standalone: true,
  imports: [
    DialogHeaderComponent,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButtonModule,
    MatCardModule,
    MatIcon,
    TranslocoPipe
  ],
  templateUrl: './my-experienceslist.component.html',
  styleUrl: './my-experienceslist.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyExperienceslistComponent implements OnInit {
  readonly help = inject(HelpDialogService);
  private readonly bookmarkService = inject(ExperienceBookmarkService);
  private readonly viatorService = inject(ViatorService);
  private readonly transloco = inject(TranslocoService);
  private readonly dialog = inject(MatDialog);

  readonly loading = signal(true);
  readonly bookmarks = this.bookmarkService.bookmarksSignal;
  readonly hasBookmarks = computed(() => this.bookmarks().length > 0);

  async ngOnInit(): Promise<void> {
    await this.bookmarkService.ensureLoaded();
    await this.refreshSnapshots();
    this.loading.set(false);
  }

  openDetails(result: ExperienceResult): void {
    this.dialog.open(ExperienceSearchDetailDialogComponent, {
      data: { result },
      autoFocus: false,
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      maxWidth: '95vw',
      maxHeight: '95vh'
    });
  }

  onOpen(result: ExperienceResult): void {
    if (result.productUrl) {
      window.open(result.productUrl, '_blank');
    }
  }

  getExperienceHeaderBackgroundImage(result: ExperienceResult): string {
    return result.imageUrl ? `url("${result.imageUrl}")` : 'none';
  }

  getExperienceHeaderBackgroundOpacity(result: ExperienceResult): string {
    return result.imageUrl ? '0.9' : '0';
  }

  getDurationLabel(result: ExperienceResult): string {
    return result.duration || '';
  }

  getRatingLabel(result: ExperienceResult): string {
    if (!result.rating) return '';
    const rounded = Math.round(result.rating * 10) / 10;
    if (!result.reviewCount) return `${rounded.toFixed(1)}`;
    return `${rounded.toFixed(1)} (${result.reviewCount})`;
  }

  getPriceLabel(result: ExperienceResult): string {
    if (result.priceFrom === undefined || result.priceFrom === null) return '';
    const currency = result.currency || 'USD';
    const locale = this.transloco.getActiveLang() || 'en';
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(result.priceFrom);
    } catch {
      return `${result.priceFrom} ${currency}`;
    }
  }

  private async refreshSnapshots(): Promise<void> {
    const bookmarks = this.bookmarks();
    for (const bookmark of bookmarks) {
      if (!bookmark.productCode) continue;
      try {
        const detail = await firstValueFrom(this.viatorService.getProduct(bookmark.productCode, false));
        if (!detail) continue;
        const updated = this.mergeSnapshot(bookmark.snapshot, detail);
        await this.bookmarkService.updateSnapshot(bookmark.productCode, updated, Date.now());
      } catch {
        // keep existing snapshot on failure
      }
    }
  }

  private mergeSnapshot(snapshot: ExperienceResult, detail: ViatorProductDetail): ExperienceResult {
    return {
      ...snapshot,
      productCode: detail.productCode || snapshot.productCode,
      title: detail.title || snapshot.title,
      description: detail.description || snapshot.description,
      imageUrl: this.resolveLargestImage(detail) || snapshot.imageUrl
    };
  }

  private resolveLargestImage(detail: ViatorProductDetail): string | undefined {
    const images = Array.isArray(detail.images) ? detail.images : [];
    let best: { area: number; url: string } | null = null;
    for (const image of images) {
      const variants = Array.isArray(image?.variants) ? image.variants : [];
      for (const variant of variants) {
        const url = variant?.url;
        const width = variant?.width ?? 0;
        const height = variant?.height ?? 0;
        if (!url) continue;
        const area = width * height;
        if (!best || area > best.area) {
          best = { area, url };
        }
      }
    }
    return best?.url;
  }
}
