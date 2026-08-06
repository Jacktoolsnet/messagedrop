import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { Place } from '../../interfaces/place';
import { TripGoLocation } from '../../interfaces/tripgo';
import { GeolocationService } from '../../services/geolocation.service';
import { UserService } from '../../services/user.service';
import { AirQualityTileComponent } from '../tile/air-quality-tile/air-quality-tile.component';
import { WeatherTileComponent } from '../tile/weather-tile/weather-tile.component';
import { WikipediaTileComponent } from '../tile/wikipedia-tile/wikipedia-tile.component';
import { MessageTileComponent } from '../tile/message-tile/messagetile.component';

interface NearbyPlaceholderTile {
  icon: string;
  titleKey: string;
  private?: boolean;
}

@Component({
  selector: 'app-tripgo-nearby-tiles',
  imports: [
    AirQualityTileComponent,
    MatIconModule,
    MessageTileComponent,
    TranslocoPipe,
    WeatherTileComponent,
    WikipediaTileComponent
  ],
  templateUrl: './tripgo-nearby-tiles.component.html',
  styleUrl: './tripgo-nearby-tiles.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TripGoNearbyTilesComponent {
  readonly location = input.required<TripGoLocation>();
  private readonly geolocation = inject(GeolocationService);
  private readonly user = inject(UserService);

  readonly place = computed<Place>(() => {
    const location = this.location();
    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);
    const radiusMeters = 2_000;
    const latitudeDelta = radiusMeters / 111_320;
    const longitudeDelta = radiusMeters
      / (111_320 * Math.max(Math.abs(Math.cos(latitude * Math.PI / 180)), 0.01));
    return {
      id: `tripgo-route-point:${latitude.toFixed(5)}:${longitude.toFixed(5)}`,
      userId: '',
      name: location.name || location.address || '',
      location: {
        latitude,
        longitude,
        plusCode: this.geolocation.getPlusCode(latitude, longitude)
      },
      base64Avatar: '',
      icon: 'location_on',
      subscribed: false,
      pinned: false,
      boundingBox: {
        latMin: latitude - latitudeDelta,
        lonMin: longitude - longitudeDelta,
        latMax: latitude + latitudeDelta,
        lonMax: longitude + longitudeDelta
      },
      timezone: location.timezone || '',
      datasets: {
        weatherDataset: { data: undefined, lastUpdate: undefined },
        airQualityDataset: { data: undefined, lastUpdate: undefined }
      }
    };
  });

  readonly placeholderTiles: NearbyPlaceholderTile[] = [
    { icon: 'note', titleKey: 'common.tripGo.nearby.privateNotes', private: true },
    { icon: 'photo_library', titleKey: 'common.tripGo.nearby.privateImages', private: true },
    { icon: 'description', titleKey: 'common.tripGo.nearby.privateDocuments', private: true },
    { icon: 'visibility', titleKey: 'common.tripGo.nearby.secretDrops' }
  ];

  isAuthenticated(): boolean {
    return this.user.hasJwt();
  }
}
