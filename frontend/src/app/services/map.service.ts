import { EventEmitter, Injectable } from '@angular/core';
import * as leaflet from 'leaflet';
import { Location } from '../interfaces/location';
import { Message } from '../interfaces/message';
import { GeolocationService } from './geolocation.service';

const messageDropMarker = leaflet.icon({
  iconUrl: 'assets/message-marker.png',

  iconSize:     [48, 58], // size of the icon
  iconAnchor:   [24, 58], // point of the icon which will correspond to marker's location
});

const userMarker = leaflet.icon({
  iconUrl: 'assets/user-marker.png',

  iconSize:     [24, 29], // size of the icon
  iconAnchor:   [12, 58], // point of the icon which will correspond to marker's location
});

@Injectable({
  providedIn: 'root'
})
export class MapService {

  private map: any;
  private userMarker: any;
  private location!: Location;

  private messageMarkers: leaflet.Marker[] = [];
  private markerClickEvent!: EventEmitter<Location>;

  constructor(private geolocationService: GeolocationService) { }

  public initMap(location: Location, zoomEvent:EventEmitter<number>, markerClickEvent: EventEmitter<Location>): void {
    this.location = location;
    this.markerClickEvent = markerClickEvent;

    this.map = leaflet.map('map', {
      center: [ location.latitude, location.longitude ],
      zoom: 10
    });

    this.map.on('zoomend', (ev: any) => {
      this.location.zoom = this.map.getZoom();
      zoomEvent.emit(this.location.zoom);
    });

    const tiles = leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      minZoom: 10,
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });

    tiles.addTo(this.map);

    this.userMarker = leaflet.marker([this.location.latitude, this.location.longitude], {icon: userMarker, zIndexOffset: 100}).addTo(this.map);
  }

  public flyTo(location: Location): void {
    this.map?.flyTo(new leaflet.LatLng(location.latitude, location.longitude), location.zoom);    
  }

  public moveToWatchedPosition():void {
    this.map?.moveTo(new leaflet.LatLng(this.location.latitude, this.location.longitude), this.location.zoom);    
  }

  public moveTo(location: Location): void {
    this.map?.moveTo(new leaflet.LatLng(location.latitude, location.longitude), location.zoom);    
  }

  public setLocation (location: Location) {
    this.location = location;
    this.map?.flyTo(new leaflet.LatLng(this.location.latitude, this.location.longitude), this.location.zoom);
    this.userMarker?.setLatLng([this.location.latitude, this.location.longitude]).update();
  }

  public setMessagesPin(messages: Message[]) {    
    // remove pins
    this.messageMarkers.forEach((marker) => marker.removeFrom(this.map));
    // clear marker array
    this.messageMarkers.length = 0
    // Get plusCode based on map zoom.
    let plusCode: string = this.geolocationService.getPlusCodeBasedOnMapZoom(this.location);
    if (plusCode !== '') {
      // Max zoomed in. Show one marker for each Massage.
      let markerExist: boolean;
      messages.forEach((message) => {
        markerExist = false;
        let messageLocation: Location = {
          'latitude': message.latitude || 0,
          'longitude': message.longitude || 0,
          'plusCode': message.plusCode || '',
          'zoom': this.location.zoom
        };
        let plusCodeLength: number = this.geolocationService.getGroupedPlusCodeLengthBasedOnMapZoom(messageLocation);
        messageLocation = this.geolocationService.getLocationFromPlusCode(message.plusCode || '', plusCodeLength);
        // Search if a marker for the location exist already
        this.messageMarkers.forEach((marker) => {
          if (marker.getLatLng().lat === messageLocation.latitude && marker.getLatLng().lng === messageLocation.longitude) {                
            markerExist = true;
          }
        })
        // Add if needed.
        if (!markerExist) {
          let marker: leaflet.Marker = leaflet.marker([messageLocation.latitude, messageLocation.longitude], {icon: messageDropMarker, zIndexOffset: 0})
          marker.on('click', ($event: leaflet.LeafletMouseEvent)  => {
            this.showMessagesFromMarker($event.target, messageLocation);
          });
          this.messageMarkers.push(marker)
        }
      });
    }
    // add to map
    this.messageMarkers?.forEach((marker) => marker.addTo(this.map));
    }

    private showMessagesFromMarker(marker: leaflet.Marker, location: Location) {
      this.markerClickEvent.emit(location);
    }
  
}
