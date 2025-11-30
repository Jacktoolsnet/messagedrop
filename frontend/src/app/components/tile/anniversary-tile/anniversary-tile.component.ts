import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { Place } from '../../../interfaces/place';
import { TileSetting } from '../../../interfaces/tile-settings';
import { PlaceService } from '../../../services/place.service';
import { AnniversaryTileEditComponent } from './anniversary-tile-edit/anniversary-tile-edit.component';

@Component({
  selector: 'app-anniversary-tile',
  standalone: true,
  imports: [CommonModule, MatIcon],
  templateUrl: './anniversary-tile.component.html',
  styleUrl: './anniversary-tile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnniversaryTileComponent implements OnChanges {
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
    return tile?.payload?.title?.trim() || tile?.label || 'Anniversary';
  }

  get icon(): string {
    return this.currentTile()?.payload?.icon || 'event';
  }

  get formattedDate(): string {
    const date = this.currentTile()?.payload?.date;
    if (!date) return 'Add a date';
    const d = this.parseLocalDate(date);
    if (!d) return 'Invalid date';
    return new Intl.DateTimeFormat(navigator.language, { dateStyle: 'long' }).format(d);
  }

  openEditor(): void {
    const tile = this.currentTile();
    if (!tile) return;

    const ref = this.dialog.open(AnniversaryTileEditComponent, {
      width: 'auto',
      minWidth: '450px',
      maxWidth: '95vw',
      height: 'auto',
      maxHeight: '95vh',
      autoFocus: false,
      data: { tile }
    });

    ref.afterClosed().subscribe((updated?: TileSetting) => {
      if (!updated) return;
      const tiles = (this.place.tileSettings ?? []).map(t => t.id === updated.id ? { ...t, ...updated } : t);
      const updatedPlace = { ...this.place, tileSettings: tiles };
      this.place = updatedPlace;
      this.currentTile.set(updated);
      this.placeService.saveAdditionalPlaceInfos(updatedPlace);
      this.cdr.markForCheck();
    });
  }

  private parseLocalDate(value: string): Date | null {
    const [y, m, d] = value.split('-').map(Number);
    if (!y || !m || !d) return null;
    const date = new Date(y, m - 1, d);
    return Number.isNaN(date.getTime()) ? null : date;
  }
}
