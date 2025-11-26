import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Place } from '../../../interfaces/place';
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
}
