import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Place } from '../../../interfaces/place';
import { TileSetting, normalizeTileSettings } from '../../../interfaces/tile-settings';
import { WeatherTileComponent } from "../../placelist/weather-tile/weather-tile.component";
import { AirQualityTileComponent } from "../air-quality-tile/air-quality-tile.component";
import { DateTimeTileComponent } from "../datetime-tile/datetime-tile.component";
import { ImageTileComponent } from "../image-tile/image-tile.component";
import { MessageTileComponent } from "../message-tile/messagetile.component";
import { NoteTileComponent } from "../note-tile/note-tile.component";
import { MasonryItemDirective } from "../../../directives/masonry-item.directive";

@Component({
  selector: 'app-tile-list',
  imports: [DateTimeTileComponent, WeatherTileComponent, AirQualityTileComponent, NoteTileComponent, MessageTileComponent, ImageTileComponent, MasonryItemDirective],
  templateUrl: './tile-list.component.html',
  styleUrl: './tile-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TileListComponent {
  @Input() place!: Place;

  private readonly renderableTypes = new Set<TileSetting['type']>(['datetime', 'weather', 'airQuality', 'note', 'message', 'image']);

  get visibleTiles(): TileSetting[] {
    return normalizeTileSettings(this.place.tileSettings)
      .filter((tile: TileSetting) => tile.enabled && this.renderableTypes.has(tile.type));
  }

  trackByTile = (_: number, tile: TileSetting) => tile.id;
}
