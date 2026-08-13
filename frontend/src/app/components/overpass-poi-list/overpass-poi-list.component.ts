import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { TranslocoPipe } from '@jsverse/transloco';
import { OverpassPoi } from '../../interfaces/overpass';

@Component({
  selector: 'app-overpass-poi-list',
  standalone: true,
  imports: [MatDialogTitle, MatDialogContent, MatIconModule, MatListModule, TranslocoPipe],
  templateUrl: './overpass-poi-list.component.html',
  styleUrl: './overpass-poi-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverpassPoiListComponent {
  readonly data = inject<{ pois: OverpassPoi[] }>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<OverpassPoiListComponent>);

  select(poi: OverpassPoi): void {
    this.dialogRef.close(poi);
  }

  address(poi: OverpassPoi): string {
    return [
      [poi.address.street, poi.address.houseNumber].filter(Boolean).join(' '),
      [poi.address.postcode, poi.address.city].filter(Boolean).join(' ')
    ].filter(Boolean).join(', ');
  }
}
