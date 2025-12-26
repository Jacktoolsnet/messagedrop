import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, inject } from '@angular/core';
import { MasonryItemDirective } from "../../../directives/masonry-item.directive";
import { Place } from '../../../interfaces/place';
import { TileSetting, normalizeTileSettings } from '../../../interfaces/tile-settings';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { PlaceService } from '../../../services/place.service';
import { Contact } from '../../../interfaces/contact';
import { ContactService } from '../../../services/contact.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { AirQualityTileComponent } from "../air-quality-tile/air-quality-tile.component";
import { AnniversaryTileComponent } from "../anniversary-tile/anniversary-tile.component";
import { DateTimeTileComponent } from "../datetime-tile/datetime-tile.component";
import { ImageTileComponent } from "../image-tile/image-tile.component";
import { FileTileComponent } from "../file-tile/file-tile.component";
import { LinkTileComponent } from "../link-tile/link-tile.component";
import { MigraineTileComponent } from "../migraine-tile/migraine-tile.component";
import { PollutionTileComponent } from "../pollution-tile/pollution-tile.component";
import { MessageTileComponent } from "../message-tile/messagetile.component";
import { MultitextTileComponent } from "../multitext-tile/multitext-tile.component";
import { NoteTileComponent } from "../note-tile/note-tile.component";
import { QuickActionTileComponent } from "../quick-action-tile/quick-action-tile.component";
import { TextTileComponent } from "../text-tile/text-tile.component";
import { TodoTileComponent } from "../todo-tile/todo-tile.component";
import { WeatherTileComponent } from "../weather-tile/weather-tile.component";
import { TileSettingsComponent } from '../tile-settings/tile-settings.component';

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

  get visibleTiles(): TileSetting[] {
    if (!this.place && !this.contact) return [];
    const sourceTiles = this.contact ? this.contact.tileSettings : this.place?.tileSettings;
    const opts = this.contact ? { includeDefaults: false, includeSystem: false } : undefined;
    return normalizeTileSettings(sourceTiles, opts)
      .filter((tile: TileSetting) => tile.enabled && this.renderableTypes.has(tile.type));
  }

  get hasVisibleTiles(): boolean {
    return this.visibleTiles.length > 0;
  }

  openTileSettings(): void {
    const dialogRef = this.dialog.open(TileSettingsComponent, {
      width: 'auto',
      minWidth: '450px',
      maxWidth: '90vw',
      maxHeight: '90vh',
      data: this.contact ? { contact: this.contact } : { place: this.place }
    });

    dialogRef.afterClosed().subscribe((updatedSettings?: TileSetting[]) => {
      if (!updatedSettings) {
        return;
      }

      const normalized = normalizeTileSettings(updatedSettings, {
        includeDefaults: !!this.place,
        includeSystem: !!this.place
      }).map((tile: TileSetting) => ({ ...tile }));

      if (this.contact) {
        const updatedContact = { ...this.contact, tileSettings: normalized };
        this.contact = updatedContact;
        void this.contactService.saveContactTileSettings(updatedContact, normalized);
      } else if (this.place) {
        const updatedPlace = { ...this.place, tileSettings: normalized };
        this.place = updatedPlace;
        this.placeService.saveAdditionalPlaceInfos(updatedPlace);
      }
      this.cdr.detectChanges();
    });
  }

  trackByTile = (_: number, tile: TileSetting) => tile.id;
}
