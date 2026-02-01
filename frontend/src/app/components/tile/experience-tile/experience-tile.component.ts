import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges, computed, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ExperienceResult, ViatorDestinationLookup } from '../../../interfaces/viator';
import { Place } from '../../../interfaces/place';
import { ExperienceBookmarkService } from '../../../services/experience-bookmark.service';
import { ExperienceMapService } from '../../../services/experience-map.service';
import { ExperienceTileDetailComponent } from './experience-tile-detail/experience-tile-detail.component';

@Component({
  selector: 'app-experience-tile',
  imports: [MatIcon, TranslocoPipe],
  templateUrl: './experience-tile.component.html',
  styleUrl: './experience-tile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExperienceTileComponent implements OnChanges {
  @Input() place!: Place;

  private readonly dialog = inject(MatDialog);
  private readonly bookmarkService = inject(ExperienceBookmarkService);
  private readonly experienceMapService = inject(ExperienceMapService);

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

  openTileDialog(event?: Event): void {
    event?.stopPropagation();
    void this.ensureDestination().then((destination) => {
      this.dialog.open(ExperienceTileDetailComponent, {
        data: {
          destinationId: destination?.destinationId ?? 0,
          destinationName: destination?.name ?? ''
        },
        closeOnNavigation: true,
        minWidth: 'min(450px, 95vw)',
        maxWidth: '95vw',
        width: '95vw',
        maxHeight: 'none',
        height: 'auto',
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop',
        disableClose: false,
        autoFocus: false
      });
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

  private async ensureDestination(): Promise<ViatorDestinationLookup | null> {
    if (!this.destination()) {
      await this.loadDestination();
    }
    return this.destination();
  }

  // Bookmarking happens in detail dialog; no add button in tile overview.
}
