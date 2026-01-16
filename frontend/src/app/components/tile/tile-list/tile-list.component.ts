import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { MasonryItemDirective } from "../../../directives/masonry-item.directive";
import { Contact } from '../../../interfaces/contact';
import { Place } from '../../../interfaces/place';
import { TileSetting, normalizeTileSettings } from '../../../interfaces/tile-settings';
import { ContactService } from '../../../services/contact.service';
import { PlaceService } from '../../../services/place.service';
import { AirQualityTileComponent } from "../air-quality-tile/air-quality-tile.component";
import { AnniversaryTileComponent } from "../anniversary-tile/anniversary-tile.component";
import { DateTimeTileComponent } from "../datetime-tile/datetime-tile.component";
import { FileTileComponent } from "../file-tile/file-tile.component";
import { ImageTileComponent } from "../image-tile/image-tile.component";
import { LinkTileComponent } from "../link-tile/link-tile.component";
import { MessageTileComponent } from "../message-tile/messagetile.component";
import { MigraineTileComponent } from "../migraine-tile/migraine-tile.component";
import { MultitextTileComponent } from "../multitext-tile/multitext-tile.component";
import { NoteTileComponent } from "../note-tile/note-tile.component";
import { PollutionTileComponent } from "../pollution-tile/pollution-tile.component";
import { QuickActionTileComponent } from "../quick-action-tile/quick-action-tile.component";
import { TextTileComponent } from "../text-tile/text-tile.component";
import { TileSettingsComponent } from '../tile-settings/tile-settings.component';
import { TodoTileComponent } from "../todo-tile/todo-tile.component";
import { WeatherTileComponent } from "../weather-tile/weather-tile.component";

@Component({
  selector: 'app-tile-list',
  imports: [DateTimeTileComponent, WeatherTileComponent, AirQualityTileComponent, NoteTileComponent, MessageTileComponent, ImageTileComponent, FileTileComponent, TextTileComponent, MultitextTileComponent, LinkTileComponent, AnniversaryTileComponent, MigraineTileComponent, PollutionTileComponent, TodoTileComponent, QuickActionTileComponent, MasonryItemDirective, MatButtonModule, TranslocoPipe],
  templateUrl: './tile-list.component.html',
  styleUrl: './tile-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TileListComponent {
  @Input() place?: Place;
  @Input() contact?: Contact;

  private readonly dialog = inject(MatDialog);
  private readonly placeService = inject(PlaceService);
  private readonly contactService = inject(ContactService);
  private readonly cdr = inject(ChangeDetectorRef);

  private readonly renderableTypes = new Set<TileSetting['type']>(['datetime', 'weather', 'airQuality', 'note', 'message', 'image', 'custom-text', 'custom-multitext', 'custom-link', 'custom-date', 'custom-todo', 'custom-quickaction', 'custom-file', 'custom-migraine', 'custom-pollution']);

  get resolvedPlace(): Place | undefined {
    if (!this.place) return undefined;
    return this.placeService.getPlaces().find(p => p.id === this.place?.id) ?? this.place;
  }

  get resolvedContact(): Contact | undefined {
    if (!this.contact) return undefined;
    return this.contactService.contactsSignal().find(c => c.id === this.contact?.id) ?? this.contact;
  }

  get visibleTiles(): TileSetting[] {
    if (!this.place && !this.contact) return [];
    const contact = this.resolvedContact;
    const place = this.resolvedPlace;
    const sourceTiles = contact ? contact.tileSettings : place?.tileSettings;
    const opts = contact ? { includeDefaults: false, includeSystem: false } : undefined;
    return normalizeTileSettings(sourceTiles, opts)
      .filter((tile: TileSetting) => tile.enabled && this.renderableTypes.has(tile.type));
  }

  get hasVisibleTiles(): boolean {
    return this.visibleTiles.length > 0;
  }

  getTileBackgroundImage(): string {
    const contact = this.resolvedContact;
    const place = this.resolvedPlace;
    if (contact?.chatBackgroundImage) {
      return `url(${contact.chatBackgroundImage})`;
    }
    return place?.placeBackgroundImage ? `url(${place.placeBackgroundImage})` : 'none';
  }

  getTileBackgroundOpacity(): number {
    const contact = this.resolvedContact;
    const place = this.resolvedPlace;
    if (contact?.chatBackgroundImage) {
      const transparency = contact.chatBackgroundTransparency ?? 40;
      const clamped = Math.min(Math.max(transparency, 0), 100);
      return 1 - clamped / 100;
    }
    if (!place?.placeBackgroundImage) {
      return 0;
    }
    const transparency = place.placeBackgroundTransparency ?? 40;
    const clamped = Math.min(Math.max(transparency, 0), 100);
    return 1 - clamped / 100;
  }

  openTileSettings(): void {
    const contact = this.resolvedContact;
    const place = this.resolvedPlace;
    const dialogRef = this.dialog.open(TileSettingsComponent, {
      width: 'auto',
      minWidth: 'min(450px, 95vw)',
      maxWidth: '90vw',
      maxHeight: '90vh',
      data: contact ? { contact } : { place }
    });

    dialogRef.afterClosed().subscribe((updatedSettings?: TileSetting[]) => {
      if (!updatedSettings) {
        return;
      }

      const normalized = normalizeTileSettings(updatedSettings, {
        includeDefaults: !!this.place,
        includeSystem: !!this.place
      }).map((tile: TileSetting) => ({ ...tile }));

      if (contact) {
        const updatedContact = { ...contact, tileSettings: normalized };
        this.contact = updatedContact;
        void this.contactService.saveContactTileSettings(updatedContact, normalized);
      } else if (place) {
        const updatedPlace = { ...place, tileSettings: normalized };
        this.place = updatedPlace;
        this.placeService.saveAdditionalPlaceInfos(updatedPlace);
      }
      this.cdr.detectChanges();
    });
  }

  trackByTile = (_: number, tile: TileSetting) => tile.id;
}
