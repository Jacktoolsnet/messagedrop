import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, inject, signal } from '@angular/core';

import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { Contact } from '../../../interfaces/contact';
import { Place } from '../../../interfaces/place';
import { TileSetting } from '../../../interfaces/tile-settings';
import { ContactService } from '../../../services/contact.service';
import { PlaceService } from '../../../services/place.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { TextTileEditComponent } from './text-tile-edit/text-tile-edit.component';

@Component({
  selector: 'app-text-tile',
  standalone: true,
  imports: [MatIcon, TranslocoPipe],
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
  private readonly translation = inject(TranslationHelperService);

  readonly currentTile = signal<TileSetting | null>(null);

  ngOnChanges(): void {
    this.currentTile.set(this.tile);
  }

  get title(): string {
    const tile = this.currentTile();
    const fallback = this.translation.t('common.tileTypes.text');
    return tile?.payload?.title?.trim() || tile?.label || fallback;
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
      data: { tile },
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
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
