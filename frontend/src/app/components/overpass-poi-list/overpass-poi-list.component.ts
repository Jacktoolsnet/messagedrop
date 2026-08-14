import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { OVERPASS_CATEGORY_ICONS, OverpassCategory, OverpassPoi } from '../../interfaces/overpass';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';

export type OverpassPoiListAction = 'show_on_map' | 'calculate_route';

export interface OverpassPoiListResult {
  action: OverpassPoiListAction;
  poi: OverpassPoi;
}

@Component({
  selector: 'app-overpass-poi-list',
  standalone: true,
  imports: [
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    TranslocoPipe,
    DialogHeaderComponent
  ],
  templateUrl: './overpass-poi-list.component.html',
  styleUrl: './overpass-poi-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverpassPoiListComponent {
  readonly data = inject<{ pois: OverpassPoi[] }>(MAT_DIALOG_DATA);
  readonly help = inject(HelpDialogService);
  private readonly dialogRef = inject(MatDialogRef<OverpassPoiListComponent, OverpassPoiListResult>);
  private readonly failedImages = signal<ReadonlySet<string>>(new Set());

  categoryIcon(category: OverpassCategory): string {
    return OVERPASS_CATEGORY_ICONS[category];
  }

  address(poi: OverpassPoi): string {
    return [
      [poi.address.street, poi.address.houseNumber].filter(Boolean).join(' '),
      [poi.address.postcode, poi.address.city].filter(Boolean).join(' '),
      poi.address.country
    ].filter(Boolean).join(', ');
  }

  metadataImage(poi: OverpassPoi): string | null {
    if (this.failedImages().has(poi.id)) return null;
    const value = poi.websiteMetadata?.image;
    if (!value) return null;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' ? url.toString() : null;
    } catch {
      return null;
    }
  }

  website(poi: OverpassPoi): string | null {
    const value = poi.contact.website;
    if (!value) return null;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
    } catch {
      return null;
    }
  }

  imageFailed(poi: OverpassPoi): void {
    this.failedImages.update((current) => new Set([...current, poi.id]));
  }

  headerBackground(poi: OverpassPoi): string {
    const image = this.metadataImage(poi);
    return image ? `url("${image.replaceAll('"', '%22')}")` : 'none';
  }

  showOnMap(poi: OverpassPoi): void {
    this.dialogRef.close({ action: 'show_on_map', poi });
  }

  calculateRoute(poi: OverpassPoi): void {
    this.dialogRef.close({ action: 'calculate_route', poi });
  }

  openInMaps(poi: OverpassPoi): void {
    const query = encodeURIComponent(`${poi.latitude},${poi.longitude}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank', 'noopener,noreferrer');
  }

  webSearch(poi: OverpassPoi): void {
    const query = [poi.name, this.address(poi)].filter(Boolean).join(' ');
    if (!query) return;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer');
  }
}
