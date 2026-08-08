import { AfterViewInit, Component, EventEmitter, Input, OnChanges, OnDestroy, Output, inject, ChangeDetectionStrategy } from '@angular/core';
import { Location } from '../../interfaces/location';
import { MarkerLocation } from '../../interfaces/marker-location';
import { MapContextMenuEvent } from '../../interfaces/map-context-menu-event';
import { MapService } from '../../services/map.service';
import { UserService } from '../../services/user.service';


@Component({
  selector: 'app-map',
  imports: [],
  templateUrl: './map.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './map.component.css'
})
export class MapComponent implements AfterViewInit, OnChanges, OnDestroy {
  // The members of location are used for change detection
  @Input() lastMarkerUpdate = 0;
  @Input() location: Location = { latitude: 0, longitude: 0, plusCode: '' };
  @Input() markerLocations: Map<string, MarkerLocation> = new Map<string, MarkerLocation>();
  @Input() zoomLevelButtonLabel = 'Search settings';
  @Output() clickEvent = new EventEmitter<Location>();
  @Output() moveEndEvent = new EventEmitter<Location>();
  @Output() markerClickEvent = new EventEmitter<MarkerLocation>();
  @Output() searchSettingsClickEvent = new EventEmitter<void>();
  @Output() contextMenuEvent = new EventEmitter<MapContextMenuEvent>();

  private readonly mapService = inject(MapService);
  readonly userService = inject(UserService);
  private destroyed = false;

  ngOnChanges(): void {
    this.mapService.createMarkers(this.markerLocations);
    this.mapService.setZoomLevelButtonLabel(this.zoomLevelButtonLabel);
  }

  ngAfterViewInit(): void {
    this.initComponent();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
  }

  private async initComponent() {
    while (!this.mapService.isReady() && !this.destroyed) {
      await new Promise(f => setTimeout(f, 100));
    }
    if (this.destroyed) {
      return;
    }
    this.mapService.initMapEvents(
      this.location,
      this.clickEvent,
      this.moveEndEvent,
      this.markerClickEvent,
      this.searchSettingsClickEvent,
      this.contextMenuEvent
    );
  }

}
