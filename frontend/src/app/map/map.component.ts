import { Component, AfterViewInit , Input, Output, OnChanges, SimpleChanges, EventEmitter} from '@angular/core';
import * as leaflet from 'leaflet';

const iconRetinaUrl = 'assets/marker-icon-2x.png';
const iconUrl = 'assets/marker-icon.png';
const shadowUrl = 'assets/marker-shadow.png';
const iconDefault = leaflet.icon({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});
leaflet.Marker.prototype.options.icon = iconDefault;

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [],
  templateUrl: './map.component.html',
  styleUrl: './map.component.css'
})
export class MapComponent implements AfterViewInit, OnChanges {
  @Input() latitude: number = 0;
  @Input() longitude: number = 0;
  @Input() zoom: number = 18;
  @Output() zoomEvent = new EventEmitter<number>();

  private map: any;
  private marker: any;

  ngOnChanges(changes: SimpleChanges) {
    this.map?.setView(new leaflet.LatLng(this.latitude, this.longitude), this.zoom);
    this.marker?.setLatLng([this.latitude, this.longitude]).update();
  }

  private initMap(): void {
    this.map = leaflet.map('map', {
      center: [ this.latitude, this.longitude ],
      zoom: this.zoom
    });

    this.map.on('zoomend', (ev: any) => {
      this.zoom = this.map.getZoom();
      this.zoomEvent.emit(this.zoom);
    });

    const tiles = leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      minZoom: 3,
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });

    tiles.addTo(this.map);

    this.marker = leaflet.marker([this.latitude, this.longitude]).addTo(this.map);
  }
  
  constructor() { 
  }

  ngAfterViewInit(): void { 
    this.initMap();
  }
}
function emitEvent() {
  throw new Error('Function not implemented.');
}

