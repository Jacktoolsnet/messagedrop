import { ChangeDetectionStrategy, Component, Inject, effect, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogClose, MatDialogContent } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { HelpDialogService } from '../../help-dialog/help-dialog.service';
import { DialogHeaderComponent } from '../../dialog-header/dialog-header.component';
import { ExperienceSearchDetailDialogComponent } from '../detail-dialog/experience-search-detail-dialog.component';
import { ExperienceSearchPinDialogData, ExperienceResult } from '../../../../interfaces/viator';
import { ExperienceBookmarkService } from '../../../../services/experience-bookmark.service';
import { UserService } from '../../../../services/user.service';
import { DisplayMessageConfig } from '../../../../interfaces/display-message-config';
import { DisplayMessage } from '../../display-message/display-message.component';

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
    TranslocoPipe,
    DialogHeaderComponent
  ],
  templateUrl: './experience-search-pin-dialog.component.html',
  styleUrl: './experience-search-pin-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExperienceSearchPinDialogComponent {
  private readonly bookmarkService = inject(ExperienceBookmarkService);
  private readonly userService = inject(UserService);
  private readonly userSet = this.userService.userSet;

  constructor(
    @Inject(MAT_DIALOG_DATA) readonly data: ExperienceSearchPinDialogData,
    readonly help: HelpDialogService,
    private readonly transloco: TranslocoService,
    private readonly dialog: MatDialog
  ) {
    effect(() => {
      this.userSet();
      if (this.userService.hasJwt()) {
        this.bookmarkService.ensureLoaded().catch(() => undefined);
      }
    });
  }

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

  isBookmarked(result: ExperienceResult): boolean {
    if (!this.userService.hasJwt()) return false;
    const productCode = result.productCode;
    if (!productCode) return false;
    return this.bookmarkService.bookmarksSignal().some((bookmark) => bookmark.productCode === productCode);
  }

  onToggleBookmark(result: ExperienceResult, event?: Event): void {
    event?.stopPropagation();
    const productCode = result.productCode;
    if (!productCode) {
      return;
    }

    const saveBookmark = async () => {
      await this.bookmarkService.saveBookmark(productCode, {
        ...result,
        productCode,
        trackId: result.trackId || `viator:${productCode}`,
        provider: 'viator'
      }, Date.now());
      this.showDisplayMessage('common.experiences.saveTitle', 'common.experiences.saveMessage', 'bookmark_add', true);
    };

    const removeBookmark = () =>
      this.bookmarkService.removeBookmark(productCode).then(() => {
        this.showDisplayMessage('common.experiences.saveRemovedTitle', 'common.experiences.saveRemovedMessage', 'bookmark_remove', true);
      });

    this.bookmarkService.hasBookmark(productCode)
      .then((exists) => {
        if (!this.userService.hasJwt()) {
          this.userService.loginWithBackend(() => {
            if (exists) {
              this.showConfirmMessage(
                'common.experiences.saveExistsTitle',
                'common.experiences.saveExistsPrompt',
                () => removeBookmark().catch(() => {
                  this.showDisplayMessage('common.experiences.saveFailedTitle', 'common.experiences.saveFailedMessage', 'error', false);
                })
              );
              return;
            }
            saveBookmark().catch(() => {
              this.showDisplayMessage('common.experiences.saveFailedTitle', 'common.experiences.saveFailedMessage', 'error', false);
            });
          });
          return;
        }

        if (exists) {
          removeBookmark().catch(() => {
            this.showDisplayMessage('common.experiences.saveFailedTitle', 'common.experiences.saveFailedMessage', 'error', false);
          });
          return;
        }

        saveBookmark().catch(() => {
          this.showDisplayMessage('common.experiences.saveFailedTitle', 'common.experiences.saveFailedMessage', 'error', false);
        });
      })
      .catch(() => {
        this.showDisplayMessage('common.experiences.saveFailedTitle', 'common.experiences.saveFailedMessage', 'error', false);
      });
  }

  private showDisplayMessage(titleKey: string, messageKey: string, icon: string, autoclose = true): void {
    const config: DisplayMessageConfig = {
      showAlways: true,
      title: this.transloco.translate(titleKey),
      image: '',
      icon,
      message: this.transloco.translate(messageKey),
      button: this.transloco.translate('common.actions.ok'),
      delay: autoclose ? 1000 : 0,
      showSpinner: false,
      autoclose
    };
    this.dialog.open(DisplayMessage, {
      closeOnNavigation: false,
      data: config,
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
  }

  private showConfirmMessage(titleKey: string, messageKey: string, onConfirm: () => void): void {
    const config: DisplayMessageConfig = {
      showAlways: true,
      title: this.transloco.translate(titleKey),
      image: '',
      icon: 'bookmark_added',
      message: this.transloco.translate(messageKey),
      button: this.transloco.translate('common.actions.yes'),
      secondaryButton: this.transloco.translate('common.actions.no'),
      delay: 0,
      showSpinner: false,
      autoclose: false
    };
    const dialogRef = this.dialog.open(DisplayMessage, {
      closeOnNavigation: false,
      data: config,
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result === true) {
        onConfirm();
      }
    });
  }
}
