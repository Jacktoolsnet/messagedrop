import { EventEmitter, Injectable } from '@angular/core';
import * as leaflet from 'leaflet';
import { Location } from '../interfaces/location';
import { Message } from '../interfaces/message';
import { GeolocationService } from './geolocation.service';
import { PlusCodeArea } from '../interfaces/plus-code-area';
import { Note } from '../interfaces/note';

const messageMarker = leaflet.icon({
  iconUrl: 'assets/markers/message-marker.png',

  iconSize:     [48, 58], // size of the icon
  iconAnchor:   [24, 58], // point of the icon which will correspond to marker's location
});

const noteMarker = leaflet.icon({
  iconUrl: 'assets/markers/note-marker.png',

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
  private searchRectangle: any;
  private circleMarker: any;
  private drawCircleMarker: boolean = false;
  private location: Location = { latitude: 0, longitude: 0, zoom: 10, plusCode: ''};

  private messageMarkerClickEvent!: EventEmitter<Location>;
  private noteMarkerClickEvent!: EventEmitter<Location>;

  private messageMarkers: leaflet.Marker[] = [];  
  private noteMarkers: leaflet.Marker[] = [];
  

  constructor(private geolocationService: GeolocationService) { }

  public initMap(location: Location, clickEvent:EventEmitter<Location>, moveEndEvent:EventEmitter<Location>, messageMarkerClickEvent:EventEmitter<Location>, noteMarkerClickEvent: EventEmitter<Location>): void {
    this.messageMarkerClickEvent = messageMarkerClickEvent;
    this.noteMarkerClickEvent = noteMarkerClickEvent;

    this.map = leaflet.map('map', {
      center: [ location.latitude, location.longitude ],
      zoom: 0
    });

    this.map.on('click', (ev: any) => {
      this.drawCircleMarker = false;
      this.location.latitude = ev.latlng?.lat;
      this.location.longitude = ev.latlng?.lng;
      this.location.zoom = this.map.getZoom();
      this.location.plusCode = this.geolocationService.getPlusCode(ev.latlng?.lat, ev.latlng?.lng);
      clickEvent.emit(this.location);
    });

    this.map.on('zoomstart', (ev: any) => {      
      this.circleMarker?.removeFrom(this.map);
    });

    this.map.on('zoomend', (ev: any) => {      
      this.location.latitude = this.map.getCenter().lat;
      this.location.longitude = this.map.getCenter().lng;
      this.location.zoom = this.map.getZoom();
      this.location.plusCode = this.geolocationService.getPlusCode(this.map.getCenter().lat, this.map.getCenter().lng);
    });

    // MoveEnd fires after click (only if flyto is used) and after zoomeend (always).
    this.map.on('moveend', (ev: any) => {
      this.location.latitude = this.map.getCenter().lat;
      this.location.longitude = this.map.getCenter().lng;
      this.location.zoom = this.map.getZoom();
      this.location.plusCode = this.geolocationService.getPlusCode(this.map.getCenter().lat, this.map.getCenter().lng);
      moveEndEvent.emit(this.location);
    });

    const tiles = leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      minZoom: 3,
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });

    tiles.addTo(this.map);

    // Fire event to load first messagens
    this.location.plusCode = this.geolocationService.getPlusCode(0, 0);
    this.searchRectangle = leaflet.rectangle([[0, 0],[0, 0]], {color: "#ff7800", weight: 1}).addTo(this.map);
    this.drawSearchRectange(this.location);
  }

  public getMapZoom(): any {
    this.map.getZoom();
  }

  public getMapLocation(): Location {
    return this.location;
  }

  public flyTo(location: Location): void {
    this.location.zoom = location.zoom
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

  public setDrawCircleMarker(value: boolean) {
    this.drawCircleMarker = value;
  }

  public setCircleMarker (location: Location) {
    this.circleMarker?.removeFrom(this.map);
    if (this.drawCircleMarker) {
      this.circleMarker = leaflet.circleMarker([location.latitude, location.longitude]).addTo(this.map);    
    }
  }

  public drawSearchRectange(location: Location) {
    let plusCodeArea : PlusCodeArea = this.geolocationService.getGridFromPlusCode(this.geolocationService.getPlusCodeBasedOnMapZoom(this.location));
    let bounds = [[plusCodeArea.latitudeLo, plusCodeArea.longitudeLo],[plusCodeArea.latitudeHi, plusCodeArea.longitudeHi]];
    this.searchRectangle.setBounds(bounds);
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
        if (this.map.getZoom() > 16) {
          let marker: leaflet.Marker = leaflet.marker([messageLocation.latitude, messageLocation.longitude], {icon: messageMarker, zIndexOffset: 0})
          marker.on('click', ($event: leaflet.LeafletMouseEvent)  => {
            this.drawCircleMarker = true;
            this.setCircleMarker(messageLocation);
            this.drawCircleMarker = false
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
            let marker: leaflet.Marker = leaflet.marker([messageLocation.latitude, messageLocation.longitude], {icon: messageMarker, zIndexOffset: 0})
            marker.on('click', ($event: leaflet.LeafletMouseEvent)  => {
              this.drawCircleMarker = true;
              this.setCircleMarker(messageLocation);
              this.drawCircleMarker = false;
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

    public setNotesPin(notes: Note[]) {    
      // remove pins
      this.noteMarkers.forEach((marker) => marker.removeFrom(this.map));
      // clear marker array
      this.noteMarkers.length = 0
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
        notes.forEach((note) => {
          markerExist = false;
          let noteLocation: Location = {
            'latitude': note.latitude || 0,
            'longitude': note.longitude || 0,
            'plusCode': note.plusCode || '',
            'zoom': this.map.getZoom()
          };
          if (this.map.getZoom() > 16) {
            let marker: leaflet.Marker = leaflet.marker([noteLocation.latitude, noteLocation.longitude], {icon: noteMarker, zIndexOffset: 0})
            marker.on('click', ($event: leaflet.LeafletMouseEvent)  => {
              this.drawCircleMarker = true;
              this.setCircleMarker(noteLocation);
              this.drawCircleMarker = false
              this.showNotesFromMarker($event.target, noteLocation);
            });
            this.noteMarkers.push(marker)
          } else {
            // Left upper corner for notes.
            let plusCodeArea : PlusCodeArea = this.geolocationService.getGridFromPlusCode(this.geolocationService.getPlusCodeBasedOnMapZoom(noteLocation));
            noteLocation.latitude = plusCodeArea.latitudeHi
            noteLocation.longitude = plusCodeArea.longitudeLo
            // Search if a marker for the location exist already
            this.noteMarkers.forEach((marker) => {
              if (marker.getLatLng().lat === noteLocation.latitude && marker.getLatLng().lng === noteLocation.longitude) {                
                markerExist = true;
              }
            })
            // Add if needed.
            if (!markerExist) {
              let marker: leaflet.Marker = leaflet.marker([noteLocation.latitude, noteLocation.longitude], {icon: noteMarker, zIndexOffset: 0})
              marker.on('click', ($event: leaflet.LeafletMouseEvent)  => {
                this.drawCircleMarker = true;
                this.setCircleMarker(noteLocation);
                this.drawCircleMarker = false;
                this.showNotesFromMarker($event.target, noteLocation);
              });
              this.noteMarkers.push(marker)
            }
          }
        });
      }
      // add to map
      this.noteMarkers?.forEach((marker) => marker.addTo(this.map));
    }

    private showMessagesFromMarker(marker: leaflet.Marker, location: Location) {
      this.messageMarkerClickEvent.emit(location);
    }

    private showNotesFromMarker(marker: leaflet.Marker, location: Location) {
      this.noteMarkerClickEvent.emit(location);
    }
    
}
