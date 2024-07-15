import { EventEmitter, Injectable } from '@angular/core';
import * as leaflet from 'leaflet';
import { Location } from '../interfaces/location';
import { Message } from '../interfaces/message';
import { GeolocationService } from './geolocation.service';
import { PlusCodeArea } from '../interfaces/plus-code-area';
import { Note } from '../interfaces/note';
import { MarkerLocation } from '../interfaces/marker-location';
import { MarkerType } from '../interfaces/marker-type';

const messageMarker = leaflet.icon({
  iconUrl: 'assets/markers/message-marker.svg',

  iconSize:     [32, 40], // size of the icon
  iconAnchor:   [16, 40], // point of the icon which will correspond to marker's location
});

const noteMarker = leaflet.icon({
  iconUrl: 'assets/markers/note-marker.svg',

  iconSize:     [32, 40], // size of the icon
  iconAnchor:   [16, 40], // point of the icon which will correspond to marker's location
});

const multiMarker = leaflet.icon({
  iconUrl: 'assets/markers/multi-marker.svg',

  iconSize:     [32, 40], // size of the icon
  iconAnchor:   [16, 40], // point of the icon which will correspond to marker's location
});

const userMarker = leaflet.icon({
  iconUrl: 'assets/markers/user-marker.svg',

  iconSize:     [32, 40], // size of the icon
  iconAnchor:   [16, 40], // point of the icon which will correspond to marker's location
});

@Injectable({
  providedIn: 'root'
})
export class MapService {

  private map: any;
  private userMarker: any;
  private searchRectangle!: any;
  private circleMarker: any;
  private drawCircleMarker: boolean = false;
  private location: Location = { latitude: 0, longitude: 0, zoom: 10, plusCode: ''};

  private markerClickEvent!: EventEmitter<MarkerLocation>;

  private messageMarkers: leaflet.Marker[] = [];  
  

  constructor(private geolocationService: GeolocationService) { }

  public initMap(location: Location, clickEvent:EventEmitter<Location>, moveEndEvent:EventEmitter<Location>, markerClickEvent:EventEmitter<MarkerLocation>): void {
    this.markerClickEvent = markerClickEvent;

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

  public getMapZoom(): number {
    return this.location.zoom;
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
      this.userMarker = leaflet.marker([location.latitude, location.longitude], {icon: userMarker, zIndexOffset: 0}).addTo(this.map);
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

  public getSearchRectangeCenter(location: Location): number[] {
    let plusCodeArea : PlusCodeArea = this.geolocationService.getGridFromPlusCode(this.geolocationService.getPlusCodeBasedOnMapZoom(this.location));
    let center: number[] = [(plusCodeArea.latitudeLo + plusCodeArea.latitudeHi) / 2, (plusCodeArea.longitudeLo + plusCodeArea.longitudeHi) / 2];
    return center;
  }

  public createMarkers(markerLocations: Map<string, MarkerLocation>) {
    // remove pins
    this.messageMarkers.forEach((marker) => {
      marker.removeFrom(this.map)
    });
    this.messageMarkers.length = 0;
    // create new markers
    markerLocations.forEach((markerLocation) => {
      switch (markerLocation.type) {
        case MarkerType.PUBLIC_MESSAGE:
          let markerForPublicMessage: leaflet.Marker = leaflet.marker([markerLocation.latitude, markerLocation.longitude], {icon: messageMarker, zIndexOffset: 20})
          markerForPublicMessage.on('click', ($event: leaflet.LeafletMouseEvent)  => {
            this.drawCircleMarker = true;
            this.setCircleMarker({
              latitude: markerLocation.latitude,
              longitude: markerLocation.longitude,
              zoom: this.getMapZoom(),
              plusCode: markerLocation.plusCode
            });
            this.drawCircleMarker = false;
            this.showDataFromMarker(markerLocation);
          });
          this.messageMarkers.push(markerForPublicMessage)
          break;
        case MarkerType.PRIVATE_NOTE:
          let markerForPrivateNote: leaflet.Marker = leaflet.marker([markerLocation.latitude, markerLocation.longitude], {icon: noteMarker, zIndexOffset: 15})
          markerForPrivateNote.on('click', ($event: leaflet.LeafletMouseEvent)  => {
            this.drawCircleMarker = true;
            this.setCircleMarker({
              latitude: markerLocation.latitude,
              longitude: markerLocation.longitude,
              zoom: this.getMapZoom(),
              plusCode: markerLocation.plusCode
            });
            this.drawCircleMarker = false;
            this.showDataFromMarker(markerLocation);
          });
          this.messageMarkers.push(markerForPrivateNote)
          break;
        case MarkerType.MULTI:
          let markerMulti: leaflet.Marker = leaflet.marker([markerLocation.latitude, markerLocation.longitude], {icon: multiMarker, zIndexOffset: 5})
          markerMulti.on('click', ($event: leaflet.LeafletMouseEvent)  => {
            this.drawCircleMarker = true;
            this.setCircleMarker({
              latitude: markerLocation.latitude,
              longitude: markerLocation.longitude,
              zoom: this.getMapZoom(),
              plusCode: markerLocation.plusCode
            });
            this.drawCircleMarker = false;
            this.showDataFromMarker(markerLocation);
          });
          this.messageMarkers.push(markerMulti)
          break;
      }
    })
    // add to map
    this.messageMarkers?.forEach((marker) => marker.addTo(this.map));
  }

  private showDataFromMarker(markerLocation: MarkerLocation) {
    this.markerClickEvent.emit(markerLocation);
  }
    
}
