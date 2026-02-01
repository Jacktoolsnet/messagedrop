import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogActions, MatDialogContent, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ExperienceResult } from '../../../../interfaces/viator';
import { ExperienceBookmarkService } from '../../../../services/experience-bookmark.service';
import { UserService } from '../../../../services/user.service';
import { ExperienceSearchDetailDialogComponent } from '../../../utils/experience-search/detail-dialog/experience-search-detail-dialog.component';
import { DialogHeaderComponent } from '../../../utils/dialog-header/dialog-header.component';
import { ExperienceSearchComponent } from '../../../utils/experience-search/experience-search.component';
import { HelpDialogService } from '../../../utils/help-dialog/help-dialog.service';

export interface ExperienceTileDetailData {
  destinationId: number;
  destinationName?: string | null;
}

@Component({
  selector: 'app-experience-tile-detail',
  standalone: true,
  imports: [
    CommonModule,
    DialogHeaderComponent,
    MatDialogContent,
    MatDialogActions,
    MatButtonModule,
    MatIcon,
    TranslocoPipe
  ],
  templateUrl: './experience-tile-detail.component.html',
  styleUrl: './experience-tile-detail.component.css'
})
export class ExperienceTileDetailComponent implements OnInit {
  private readonly dialogData = inject<ExperienceTileDetailData>(MAT_DIALOG_DATA);
  private readonly bookmarkService = inject(ExperienceBookmarkService);
  private readonly userService = inject(UserService);
  private readonly dialog = inject(MatDialog);
  readonly help = inject(HelpDialogService);
  readonly dialogRef = inject(MatDialogRef<ExperienceTileDetailComponent>);

  readonly destinationName = signal(this.dialogData.destinationName ?? '');

  readonly experiences = computed(() => {
    const destinationId = Number(this.dialogData.destinationId);
    if (!destinationId) {
      return [] as ExperienceResult[];
    }
    return this.bookmarkService.bookmarksSignal()
      .map((bookmark) => bookmark.snapshot)
      .filter((snapshot) => (snapshot.destinationIds ?? []).includes(destinationId));
  });

  ngOnInit(): void {
    void this.bookmarkService.ensureLoaded().catch(() => undefined);
  }

  close(): void {
    this.dialogRef.close();
  }

  openSearch(): void {
    const destinationId = Number(this.dialogData.destinationId) || 0;
    const dialogRef = this.dialog.open(ExperienceSearchComponent, {
      data: {
        destinationId,
        destinationName: this.destinationName()
      },
      panelClass: '',
      closeOnNavigation: true,
      minWidth: 'min(450px, 95vw)',
      width: '90vw',
      maxWidth: '90vw',
      height: '90vh',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });

    const subscription = dialogRef.componentInstance.selected.subscribe((result: ExperienceResult) => {
      dialogRef.close(result);
    });

    dialogRef.afterClosed().subscribe((result?: ExperienceResult) => {
      subscription.unsubscribe();
      if (result) {
        this.handleSelectedExperience(result);
      }
    });
  }

  openDetail(result: ExperienceResult, event?: Event): void {
    event?.stopPropagation();
    this.dialog.open(ExperienceSearchDetailDialogComponent, {
      data: { result },
      autoFocus: false,
      backdropClass: 'dialog-backdrop',
      maxWidth: '95vw',
      maxHeight: '95vh'
    });
  }

  getExperienceTitle(result: ExperienceResult): string {
    return result.title || result.productCode || '';
  }

  getExperienceDuration(result: ExperienceResult): string {
    return result.duration || '';
  }

  getExperienceImage(result: ExperienceResult): string | null {
    return result.imageUrl || result.avatarUrl || null;
  }

  removeExperience(result: ExperienceResult, event?: Event): void {
    event?.stopPropagation();
    const productCode = result?.productCode || '';
    if (!productCode) {
      return;
    }
    const remove = () => {
      this.bookmarkService.removeBookmark(productCode).catch(() => undefined);
    };
    if (!this.userService.hasJwt()) {
      this.userService.loginWithBackend(remove);
      return;
    }
    remove();
  }

  private handleSelectedExperience(result: ExperienceResult): void {
    const productCode = result?.productCode || '';
    if (!productCode) {
      return;
    }
    const saveExperience = () => {
      const snapshot: ExperienceResult = {
        ...result,
        productCode,
        trackId: result.trackId || `viator:${productCode}`,
        provider: 'viator'
      };
      this.bookmarkService.saveBookmark(productCode, snapshot, Date.now())
        .then(() => {
          this.openDetail(snapshot);
        })
        .catch(() => undefined);
    };

    if (!this.userService.hasJwt()) {
      this.userService.loginWithBackend(saveExperience);
      return;
    }
    saveExperience();
  }
}
