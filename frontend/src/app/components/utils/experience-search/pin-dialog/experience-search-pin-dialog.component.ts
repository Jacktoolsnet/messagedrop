import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogClose, MatDialogContent } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { HelpDialogService } from '../../help-dialog/help-dialog.service';
import { ExperienceSearchDetailDialogComponent } from '../detail-dialog/experience-search-detail-dialog.component';
import { ExperienceResult } from '../experience-search.component';

export interface ExperienceSearchPinDialogData {
  destinationId: number;
  destinationName?: string;
  results: ExperienceResult[];
}

@Component({
  selector: 'app-experience-search-pin-dialog',
  standalone: true,
  imports: [
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButtonModule,
    MatCardModule,
    MatIcon,
    TranslocoPipe
  ],
  templateUrl: './experience-search-pin-dialog.component.html',
  styleUrl: './experience-search-pin-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExperienceSearchPinDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) readonly data: ExperienceSearchPinDialogData,
    readonly help: HelpDialogService,
    private readonly transloco: TranslocoService,
    private readonly dialog: MatDialog
  ) { }

  onOpen(result: ExperienceResult): void {
    if (result.productUrl) {
      window.open(result.productUrl, '_blank');
    }
  }

  openDetails(result: ExperienceResult): void {
    this.dialog.open(ExperienceSearchDetailDialogComponent, {
      data: { result },
      autoFocus: false,
      backdropClass: 'dialog-backdrop',
      maxWidth: '95vw',
      maxHeight: '95vh'
    });
  }

  getExperienceHeaderBackgroundImage(result: ExperienceResult): string {
    return result.imageUrl ? `url("${result.imageUrl}")` : 'none';
  }

  getExperienceHeaderBackgroundOpacity(result: ExperienceResult): string {
    return result.imageUrl ? '0.9' : '0';
  }

  getExperienceIcon(): string {
    return 'local_activity';
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
}
