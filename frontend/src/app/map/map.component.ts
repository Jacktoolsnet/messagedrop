import { Component, AfterViewInit , Input, Output, OnChanges, SimpleChanges, EventEmitter} from '@angular/core';
import * as leaflet from 'leaflet';
import { Location } from '../interfaces/location';
import { Message } from '../interfaces/message';


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

const messageDropMarker = leaflet.icon({
  iconUrl: 'assets/message-marker.png',

  iconSize:     [48, 58], // size of the icon
  iconAnchor:   [24, 58], // point of the icon which will correspond to marker's location
  popupAnchor:  [-3, -76] // point from which the popup should open relative to the iconAnchor
});

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [],
  templateUrl: './map.component.html',
  styleUrl: './map.component.css'
})
export class MapComponent implements AfterViewInit, OnChanges {
  static updateMap(location: Location) {
    throw new Error('Method not implemented.');
  }
  @Input() latitude: number = 0;
  @Input() longitude: number = 0;
  @Input() zoom: number = 19;
  @Input() messages: Message[] = [];
  @Output() zoomEvent = new EventEmitter<number>();

  private map: any;
  private marker: any;

  private messageMarkers: leaflet.Marker[] = [];

  ngOnChanges(changes: SimpleChanges) {
    this.map?.flyTo(new leaflet.LatLng(this.latitude, this.longitude), this.zoom);
    this.marker?.setLatLng([this.latitude, this.longitude]).update();
    // remove pins
    this.messageMarkers.forEach((marker) => marker.removeFrom(this.map));
    // clear marker array
    this.messageMarkers.length = 0
    this.messages.forEach((message) => this.messageMarkers.push(leaflet.marker([message.latitude, message.longitude], {icon: messageDropMarker})));
    // add to map
    this.messageMarkers?.forEach((marker) => marker.addTo(this.map));
  }

  private initMap(): void {
    this.map = leaflet.map('map', {
      center: [ this.latitude, this.longitude ],
      zoom: 10
    });

    this.map.on('zoomend', (ev: any) => {
      this.zoom = this.map.getZoom();
      this.zoomEvent.emit(this.zoom);
    });

    const tiles = leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      minZoom: 10,
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

