import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { Place } from '../../../interfaces/place';
import { TileSetting } from '../../../interfaces/tile-settings';
import { PlaceService } from '../../../services/place.service';
import { LinkTileEditComponent } from './link-tile-edit/link-tile-edit.component';

@Component({
  selector: 'app-link-tile',
  standalone: true,
  imports: [CommonModule, MatIcon, MatButtonModule],
  templateUrl: './link-tile.component.html',
  styleUrl: './link-tile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LinkTileComponent implements OnChanges {
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
    return tile?.payload?.title?.trim() || tile?.label || 'Link';
  }

  get icon(): string {
    return this.currentTile()?.payload?.icon || 'link';
  }

  get linkLabel(): string {
    const payload = this.currentTile()?.payload;
    if (!payload?.url) return 'Add link';
    return payload.url;
  }

  openLink(): void {
    const payload = this.currentTile()?.payload;
    if (!payload?.url) return;
    const href = this.buildHref(payload.url, payload.linkType || 'web');
    if (!href) return;
    window.open(href, '_blank');
  }

  openEditor(): void {
    const tile = this.currentTile();
    if (!tile) return;

    const dialogRef = this.dialog.open(LinkTileEditComponent, {
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

  private buildHref(url: string, type: NonNullable<TileSetting['payload']>['linkType']): string | null {
    const trimmed = url.trim();
    if (!trimmed) return null;

    switch (type) {
      case 'web':
        return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
      case 'phone':
        return `tel:${trimmed.replace(/\s+/g, '')}`;
      case 'email':
        return trimmed.startsWith('mailto:') ? trimmed : `mailto:${trimmed}`;
      case 'whatsapp':
        return `https://wa.me/${trimmed.replace(/[^0-9+]/g, '')}`;
      case 'sms':
        return `sms:${trimmed.replace(/\s+/g, '')}`;
      case 'map':
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
      default:
        return trimmed;
    }
  }
}
