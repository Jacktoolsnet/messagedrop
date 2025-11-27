import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { Place } from '../../../interfaces/place';
import { TileSetting } from '../../../interfaces/tile-settings';
import { PlaceService } from '../../../services/place.service';
import { MultitextTileEditComponent } from './multitext-tile-edit/multitext-tile-edit.component';

@Component({
  selector: 'app-multitext-tile',
  standalone: true,
  imports: [CommonModule, MatIcon],
  templateUrl: './multitext-tile.component.html',
  styleUrl: './multitext-tile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MultitextTileComponent implements OnChanges {
  @Input() tile!: TileSetting;
  @Input() place!: Place;

  private readonly dialog = inject(MatDialog);
  private readonly placeService = inject(PlaceService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly currentTile = signal<TileSetting | null>(null);

  ngOnChanges(): void {
    this.currentTile.set(this.tile);
  }

  get title(): string {
    const tile = this.currentTile();
    return tile?.payload?.title?.trim() || tile?.label || 'Multitext';
  }

  get text(): string {
    return this.currentTile()?.payload?.text || '';
  }

  get icon(): string {
    return this.currentTile()?.payload?.icon || 'segment';
  }

  editTile(): void {
    const tile = this.currentTile();
    if (!tile) return;

    const dialogRef = this.dialog.open(MultitextTileEditComponent, {
      width: '520px',
      data: { tile }
    });

    dialogRef.afterClosed().subscribe((updated?: TileSetting) => {
      if (!updated) return;
      const tiles = (this.place.tileSettings ?? []).map(t => t.id === updated.id ? { ...t, ...updated } : t);
      const updatedPlace = { ...this.place, tileSettings: tiles };
      this.place = updatedPlace;
      this.currentTile.set(updated);
      this.placeService.saveAdditionalPlaceInfos(updatedPlace);
      this.cdr.markForCheck();
    });
  }
}
