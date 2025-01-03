import { AfterViewInit, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { Location } from '../../interfaces/location';
import { MarkerLocation } from '../../interfaces/marker-location';
import { MapService } from '../../services/map.service';


@Component({
  selector: 'app-map',
  imports: [],
  templateUrl: './map.component.html',
  styleUrl: './map.component.css'
})
export class MapComponent implements AfterViewInit, OnChanges {
  // The members of location are used for change detection
  @Input() lastMarkerUpdate: number = 0;
  @Input() location: Location = { latitude: 0, longitude: 0, plusCode: '' };
  @Input() markerLocations: Map<string, MarkerLocation> = new Map<string, MarkerLocation>();
  @Output() clickEvent = new EventEmitter<Location>();
  @Output() moveEndEvent = new EventEmitter<Location>();
  @Output() markerClickEvent = new EventEmitter<MarkerLocation>();

  ngOnChanges(changes: SimpleChanges) {
    this.mapService.createMarkers(this.markerLocations);
  }

  constructor(private mapService: MapService) { }

  ngAfterViewInit(): void {
    this.mapService.initMap(this.location, this.clickEvent, this.moveEndEvent, this.markerClickEvent);
  }

}


