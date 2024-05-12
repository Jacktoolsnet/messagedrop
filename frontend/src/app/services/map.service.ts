import { EventEmitter, Injectable } from '@angular/core';
import * as leaflet from 'leaflet';
import { Location } from '../interfaces/location';
import { Message } from '../interfaces/message';
import { GeolocationService } from './geolocation.service';

const messageDropMarker = leaflet.icon({
  iconUrl: 'assets/markers/message-marker.png',

  iconSize:     [48, 58], // size of the icon
  iconAnchor:   [24, 58], // point of the icon which will correspond to marker's location
});

const userMarker = leaflet.icon({
  iconUrl: 'assets/markers/user-marker.png',

  iconSize:     [24, 29], // size of the icon
  iconAnchor:   [12, 29], // point of the icon which will correspond to marker's location
});

@Injectable({
  providedIn: 'root'
})
export class MapService {

  private map: any;
  private userMarker: any;

  private messageMarkers: leaflet.Marker[] = [];
  private markerClickEvent!: EventEmitter<Location>;

  constructor(private geolocationService: GeolocationService) { }

  public initMap(location: Location, clickEvent:EventEmitter<Location>, mapEvent:EventEmitter<Location>, markerClickEvent: EventEmitter<Location>): void {
    this.markerClickEvent = markerClickEvent;

    this.map = leaflet.map('map', {
      center: [ location.latitude, location.longitude ],
      zoom: 10
    });

    this.map.on('click', (ev: any) => {
      let location: Location = {
        latitude: ev.latlng?.lat,
        longitude: ev.latlng?.lng,
        zoom: this.map.getZoom(),
        plusCode: this.geolocationService.getPlusCode(ev.latlng?.lat, ev.latlng?.lng)
      };
      clickEvent.emit(location);
    });

    this.map.on('zoomend', (ev: any) => {
      let location: Location = {
      latitude: this.map.getCenter().lat,
      longitude: this.map.getCenter().lng,
      zoom: this.map.getZoom(),
      plusCode: this.geolocationService.getPlusCode(this.map.getCenter().lat, this.map.getCenter().lng)
      };
      mapEvent.emit(location);
    });

    this.map.on('moveend', (ev: any) => {
      let location: Location = {
      latitude: this.map.getCenter().lat,
      longitude: this.map.getCenter().lng,
      zoom: this.map.getZoom(),
      plusCode: this.geolocationService.getPlusCode(this.map.getCenter().lat, this.map.getCenter().lng)
      };
      mapEvent.emit(location);
    });

    const tiles = leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      minZoom: 6,
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });

    tiles.addTo(this.map);
  }

  public getMapZoom(): any {
    this.map.getZoom();
  }

  public flyTo(location: Location): void {
    this.map?.flyTo(new leaflet.LatLng(location.latitude, location.longitude), location.zoom);    
  }

  public moveTo(location: Location): void {
    this.map?.panTo(new leaflet.LatLng(location.latitude, location.longitude), location.zoom);
    this.map?.setZoom(location.zoom);    
  }

  public setUserMarker (location: Location) {
    if (undefined === this.userMarker) {
      this.userMarker = leaflet.marker([location.latitude, location.longitude], {icon: userMarker, zIndexOffset: 100}).addTo(this.map);
    } else {
      this.userMarker?.setLatLng([location.latitude, location.longitude]).update();
    }
  }

  public setMessagesPin(messages: Message[]) {    
    // remove pins
    this.messageMarkers.forEach((marker) => marker.removeFrom(this.map));
    // clear marker array
    this.messageMarkers.length = 0
    // Get plusCode based on map zoom.
    let location: Location = {
      latitude: this.map?.getCenter().lat,
      longitude: this.map?.getCenter().lng,
      zoom: this.map?.getZoom(),
      plusCode: this.geolocationService.getPlusCode(this.map?.getCenter().lat, this.map?.getCenter().lng)
      };
    let plusCode: string = this.geolocationService.getPlusCodeBasedOnMapZoom(location);
    if (plusCode !== '') {
      // Max zoomed in. Show one marker for each Massage.
      let markerExist: boolean;
      messages.forEach((message) => {
        markerExist = false;
        let messageLocation: Location = {
          'latitude': message.latitude || 0,
          'longitude': message.longitude || 0,
          'plusCode': message.plusCode || '',
          'zoom': this.map.getZoom()
        };
        if (this.map.getZoom() >= 19) {
          let marker: leaflet.Marker = leaflet.marker([messageLocation.latitude, messageLocation.longitude], {icon: messageDropMarker, zIndexOffset: 0})
          marker.on('click', ($event: leaflet.LeafletMouseEvent)  => {
            this.showMessagesFromMarker($event.target, messageLocation);
          });
          this.messageMarkers.push(marker)
        } else {
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
