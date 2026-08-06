import { ChangeDetectionStrategy, Component, inject, Input, OnChanges, OnDestroy, signal, SimpleChanges } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { Place } from '../../interfaces/place';
import { SecretDrop } from '../../interfaces/secret-drop';
import { GeolocationService } from '../../services/geolocation.service';
import { SecretDropService } from '../../services/secret-drop.service';
import { FoundSecretDropListComponent } from '../found-secret-drop-list/found-secret-drop-list.component';

@Component({
  selector: 'app-tripgo-secret-drop-tile',
  imports: [MatIconModule, TranslocoPipe],
  templateUrl: './tripgo-secret-drop-tile.component.html',
  styleUrl: './tripgo-secret-drop-tile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TripGoSecretDropTileComponent implements OnChanges, OnDestroy {
  @Input() place!: Place;
  @Input() radiusMeters = 2_000;

  readonly drops = signal<SecretDrop[]>([]);
  readonly loading = signal(false);

  private readonly dialog = inject(MatDialog);
  private readonly geolocation = inject(GeolocationService);
  private readonly secretDropService = inject(SecretDropService);
  private requestGeneration = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['place'] || changes['radiusMeters']) {
      void this.loadDrops();
    }
  }

  ngOnDestroy(): void {
    this.requestGeneration += 1;
  }

  previewDrops(): SecretDrop[] {
    return this.drops().slice(0, 3);
  }

  openDetail(): void {
    if (!this.drops().length) {
      return;
    }

    this.dialog.open(FoundSecretDropListComponent, {
      panelClass: 'MessageListDialog',
      closeOnNavigation: true,
      data: {
        drops: this.drops(),
        plusCode: this.place.location.plusCode,
        zoomLevel: 18
      },
      width: 'min(900px, 95vw)',
      maxWidth: '95vw',
      maxHeight: '95vh',
      height: 'auto',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
  }

  private async loadDrops(): Promise<void> {
    if (!this.place?.boundingBox) {
      return;
    }

    const generation = ++this.requestGeneration;
    this.loading.set(true);
    this.drops.set([]);
    try {
      const drops = await this.secretDropService.getVisibleOnMapByBoundingBox(this.place.boundingBox);
      if (generation !== this.requestGeneration) {
        return;
      }
      this.drops.set(drops
        .filter((drop) => this.isInsideRadius(drop))
        .sort((left, right) => Number(right.createdAt ?? 0) - Number(left.createdAt ?? 0)));
    } catch {
      if (generation === this.requestGeneration) {
        this.drops.set([]);
      }
    } finally {
      if (generation === this.requestGeneration) {
        this.loading.set(false);
      }
    }
  }

  private isInsideRadius(drop: SecretDrop): boolean {
    if (!this.radiusMeters || this.radiusMeters <= 0) {
      return true;
    }
    return this.geolocation.areLocationsNear(this.place.location, drop.location, this.radiusMeters);
  }
}
