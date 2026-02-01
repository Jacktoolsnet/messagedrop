import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ExperienceResult, ViatorDestinationLookup } from '../../../interfaces/viator';
import { Place } from '../../../interfaces/place';
import { ExperienceBookmarkService } from '../../../services/experience-bookmark.service';
import { ExperienceMapService } from '../../../services/experience-map.service';
import { UserService } from '../../../services/user.service';
import { ExperienceSearchDetailDialogComponent } from '../../utils/experience-search/detail-dialog/experience-search-detail-dialog.component';
import { ExperienceSearchComponent } from '../../utils/experience-search/experience-search.component';

@Component({
  selector: 'app-experience-tile',
  imports: [MatIcon, MatButtonModule, TranslocoPipe],
  templateUrl: './experience-tile.component.html',
  styleUrl: './experience-tile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExperienceTileComponent implements OnChanges {
  @Input() place!: Place;

  private readonly dialog = inject(MatDialog);
  private readonly bookmarkService = inject(ExperienceBookmarkService);
  private readonly experienceMapService = inject(ExperienceMapService);
  private readonly userService = inject(UserService);

  readonly destination = signal<ViatorDestinationLookup | null>(null);

  readonly matchedExperiences = computed(() => {
    const destinationId = this.destination()?.destinationId;
    if (!destinationId) {
      return [];
    }
    return this.bookmarkService.bookmarksSignal()
      .map((bookmark) => bookmark.snapshot)
      .filter((snapshot) => (snapshot.destinationIds ?? []).includes(destinationId));
  });

  readonly previewExperiences = computed(() => this.matchedExperiences().slice(0, 4));

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['place']) {
      void this.loadDestination();
    }
  }

  private async loadDestination(): Promise<void> {
    if (!this.place?.location) {
      this.destination.set(null);
      return;
    }
    await this.bookmarkService.ensureLoaded().catch(() => undefined);
    const destination = await this.experienceMapService.getDestinationForLocation(this.place.location);
    this.destination.set(destination);
  }

  async openSearch(event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!this.destination()) {
      await this.loadDestination();
    }
    const destination = this.destination();
    if (!destination) {
      return;
    }
    const dialogRef = this.dialog.open(ExperienceSearchComponent, {
      data: {
        destinationId: destination.destinationId,
        destinationName: destination.name
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

  private handleSelectedExperience(result: ExperienceResult): void {
    if (!result?.productCode) {
      return;
    }
    if (!this.userService.hasJwt()) {
      this.userService.loginWithBackend(() => {
        this.saveExperience(result);
      });
      return;
    }
    this.saveExperience(result);
  }

  private saveExperience(result: ExperienceResult): void {
    const productCode = result.productCode || '';
    if (!productCode) return;
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
  }
}
