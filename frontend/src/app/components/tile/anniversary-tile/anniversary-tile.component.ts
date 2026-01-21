
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { Contact } from '../../../interfaces/contact';
import { Place } from '../../../interfaces/place';
import { TileSetting } from '../../../interfaces/tile-settings';
import { ContactService } from '../../../services/contact.service';
import { PlaceService } from '../../../services/place.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { AnniversaryTileEditComponent } from './anniversary-tile-edit/anniversary-tile-edit.component';

@Component({
  selector: 'app-anniversary-tile',
  standalone: true,
  imports: [MatIcon],
  templateUrl: './anniversary-tile.component.html',
  styleUrl: './anniversary-tile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnniversaryTileComponent implements OnChanges {
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
    const fallback = this.translation.t('common.tileTypes.anniversary');
    return tile?.payload?.title?.trim() || tile?.label || fallback;
  }

  get icon(): string {
    return this.currentTile()?.payload?.icon || 'event';
  }

  get formattedDate(): string {
    const date = this.currentTile()?.payload?.date;
    if (!date) return this.translation.t('common.tiles.anniversary.addDate');
    const d = this.parseLocalDate(date);
    if (!d) return this.translation.t('common.tiles.anniversary.invalidDate');
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
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      data: { tile }
    });

    ref.afterClosed().subscribe((updated?: TileSetting) => {
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

  private parseLocalDate(value: string): Date | null {
    const [y, m, d] = value.split('-').map(Number);
    if (!y || !m || !d) return null;
    const date = new Date(y, m - 1, d);
    return Number.isNaN(date.getTime()) ? null : date;
  }
}
