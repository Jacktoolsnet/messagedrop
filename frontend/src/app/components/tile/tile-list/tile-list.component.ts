import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MasonryItemDirective } from "../../../directives/masonry-item.directive";
import { Place } from '../../../interfaces/place';
import { TileSetting, normalizeTileSettings } from '../../../interfaces/tile-settings';
import { AirQualityTileComponent } from "../air-quality-tile/air-quality-tile.component";
import { AnniversaryTileComponent } from "../anniversary-tile/anniversary-tile.component";
import { DateTimeTileComponent } from "../datetime-tile/datetime-tile.component";
import { ImageTileComponent } from "../image-tile/image-tile.component";
import { LinkTileComponent } from "../link-tile/link-tile.component";
import { MigraineTileComponent } from "../migraine-tile/migraine-tile.component";
import { PollutionTileComponent } from "../pollution-tile/pollution-tile.component";
import { MessageTileComponent } from "../message-tile/messagetile.component";
import { MultitextTileComponent } from "../multitext-tile/multitext-tile.component";
import { NoteTileComponent } from "../note-tile/note-tile.component";
import { TextTileComponent } from "../text-tile/text-tile.component";
import { WeatherTileComponent } from "../weather-tile/weather-tile.component";

@Component({
  selector: 'app-tile-list',
  imports: [DateTimeTileComponent, WeatherTileComponent, AirQualityTileComponent, NoteTileComponent, MessageTileComponent, ImageTileComponent, TextTileComponent, MultitextTileComponent, LinkTileComponent, AnniversaryTileComponent, MigraineTileComponent, PollutionTileComponent, MasonryItemDirective],
  templateUrl: './tile-list.component.html',
  styleUrl: './tile-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TileListComponent {
  @Input() place!: Place;

  private readonly renderableTypes = new Set<TileSetting['type']>(['datetime', 'weather', 'airQuality', 'note', 'message', 'image', 'custom-text', 'custom-multitext', 'custom-link', 'custom-date', 'custom-migraine', 'custom-pollution']);

  get visibleTiles(): TileSetting[] {
    return normalizeTileSettings(this.place.tileSettings)
      .filter((tile: TileSetting) => tile.enabled && this.renderableTypes.has(tile.type));
  }

  trackByTile = (_: number, tile: TileSetting) => tile.id;
}
