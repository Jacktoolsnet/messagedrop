import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { Place } from '../../../interfaces/place';
import { Contact } from '../../../interfaces/contact';
import { TileSetting } from '../../../interfaces/tile-settings';
import { PlaceService } from '../../../services/place.service';
import { ContactService } from '../../../services/contact.service';
import { TextTileEditComponent } from './text-tile-edit/text-tile-edit.component';

@Component({
  selector: 'app-text-tile',
  standalone: true,
  imports: [CommonModule, MatIcon],
  templateUrl: './text-tile.component.html',
  styleUrl: './text-tile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TextTileComponent implements OnChanges {
  @Input() tile!: TileSetting;
  @Input() place?: Place;
  @Input() contact?: Contact;

  private readonly dialog = inject(MatDialog);
  private readonly placeService = inject(PlaceService);
  private readonly contactService = inject(ContactService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly currentTile = signal<TileSetting | null>(null);

  ngOnChanges(): void {
    this.currentTile.set(this.tile);
  }

  get title(): string {
    const tile = this.currentTile();
    return tile?.payload?.title?.trim() || tile?.label || 'Text';
  }

  get text(): string {
    return this.currentTile()?.payload?.text || '';
  }

  get icon(): string {
    return this.currentTile()?.payload?.icon || 'short_text';
  }

  editTile(): void {
    const tile = this.currentTile();
    if (!tile) return;

    const dialogRef = this.dialog.open(TextTileEditComponent, {
      width: '520px',
      data: { tile }
    });

    dialogRef.afterClosed().subscribe((updated?: TileSetting) => {
      if (!updated) return;
      if (this.place) {
        const tiles = (this.place.tileSettings ?? []).map(t => t.id === updated.id ? { ...t, ...updated } : t);
        const updatedPlace = { ...this.place, tileSettings: tiles };
        this.place = updatedPlace;
        this.currentTile.set(updated);
        this.placeService.saveAdditionalPlaceInfos(updatedPlace);
      } else if (this.contact) {
        const tiles = (this.contact.tileSettings ?? []).map(t => t.id === updated.id ? { ...t, ...updated } : t);
        this.contact = { ...this.contact, tileSettings: tiles };
        this.currentTile.set(updated);
        this.contactService.saveContactTileSettings(this.contact);
        this.contactService.refreshContact(this.contact.id);
      }
      this.cdr.markForCheck();
    });
  }
}
