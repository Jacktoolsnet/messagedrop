import { EventEmitter, Injectable, signal } from '@angular/core';
import * as leaflet from 'leaflet';
import { BoundingBox } from '../interfaces/bounding-box';
import { Location } from '../interfaces/location';
import { MarkerLocation } from '../interfaces/marker-location';
import { MarkerType } from '../interfaces/marker-type';
import { PlusCodeArea } from '../interfaces/plus-code-area';
import { GeolocationService } from './geolocation.service';

const messageMarker = leaflet.icon({
  iconUrl: 'assets/markers/message-marker.svg',

  iconSize: [32, 40], // size of the icon
  iconAnchor: [16, 40], // point of the icon which will correspond to marker's location
});

const noteMarker = leaflet.icon({
  iconUrl: 'assets/markers/note-marker.svg',

  iconSize: [32, 40], // size of the icon
  iconAnchor: [16, 40], // point of the icon which will correspond to marker's location
});

const multiMarker = leaflet.icon({
  iconUrl: 'assets/markers/multi-marker.svg',

  iconSize: [32, 40], // size of the icon
  iconAnchor: [16, 40], // point of the icon which will correspond to marker's location
});

const userMarker = leaflet.icon({
  iconUrl: 'assets/markers/user-marker.svg',

  iconSize: [32, 40], // size of the icon
  iconAnchor: [16, 40], // point of the icon which will correspond to marker's location
});

@Injectable({
  providedIn: 'root'
})
export class MapService {

  private _mapSet = signal(0);
  readonly mapSet = this._mapSet.asReadonly();

  private map: any;
  private userMarker: any;
  private searchRectangle!: any;
  private circleMarker: any;
  private drawCircleMarker: boolean = false;
  private location: Location = { latitude: 0, longitude: 0, plusCode: '' };

  private markerClickEvent!: EventEmitter<MarkerLocation>;

  private messageMarkers: leaflet.Marker[] = [];
  private placeLocationRectangels = new Map<string, leaflet.Rectangle>();

  private ready: boolean = false;

  constructor(private geolocationService: GeolocationService) { }

  public initMap() {
    this.ready = true;
    this._mapSet.update(trigger => trigger + 1);
  }

  public initMapEvents(location: Location, clickEvent: EventEmitter<Location>, moveEndEvent: EventEmitter<Location>, markerClickEvent: EventEmitter<MarkerLocation>): void {
    this.markerClickEvent = markerClickEvent;

    this.map = leaflet.map('map', {
      center: [location.latitude, location.longitude],
      zoom: 3
    });

    //xthis.map.setMinZoom(3);
    // this.map.setMaxZoom(19);

    this.map.on('click', (ev: any) => {
      this.drawCircleMarker = false;
      this.location.latitude = ev.latlng?.lat;
      this.location.longitude = ev.latlng?.lng;
      this.location.plusCode = this.geolocationService.getPlusCode(ev.latlng?.lat, ev.latlng?.lng);
      clickEvent.emit(this.location);
    });

    this.map.on('zoomstart', (ev: any) => {
      this.circleMarker?.removeFrom(this.map);
    });

    this.map.on('zoomend', (ev: any) => { });

    // MoveEnd fires always.
    this.map.on('moveend', (ev: any) => {
      if (this.getMapZoom() < 17) {
        this.removeUserMarker();
      } else {
        this.restoreUserMarker();
      }
      this.location.latitude = this.map.getCenter().lat;
      this.location.longitude = this.map.getCenter().lng;
      this.location.plusCode = this.geolocationService.getPlusCode(this.map.getCenter().lat, this.map.getCenter().lng);
      moveEndEvent.emit(this.location);
    });

    let tiles = leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      minZoom: 3,
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });

    tiles.addTo(this.map);

    // Fire event to load first messagens
    this.location.plusCode = this.geolocationService.getPlusCode(0, 0);
    this.searchRectangle = leaflet.rectangle([[0, 0], [0, 0]], { color: "#ffdbb5", weight: 1 }).addTo(this.map);
    this.drawSearchRectange(this.location);

    this._mapSet.update(trigger => trigger + 1);
  }

  isReady(): boolean {
    return this.ready;
  }

  public fitMapToBounds(boundingBox: BoundingBox, paddingX: number = 20, paddingY: number = 20) {
    const bounds = leaflet.latLngBounds(
      [boundingBox.latMin, boundingBox.lonMin],
      [boundingBox.latMax, boundingBox.lonMax]
    );
    this.map.fitBounds(bounds, { padding: [paddingX, paddingY] });
  }

  public setMapMinMaxZoom(minZoom: number, maxZoom: number) {
    this.map?.setMinZoom(minZoom);
    this.map?.setMaxZoom(maxZoom);
  }

  public setMapZoom(zoom: number) {
    this.map?.setZoom(zoom);
  }

  public getMapZoom(): number {
    return undefined == this.map ? 3 : this.map.getZoom()
  }

  public getMapLocation(): Location {
    return this.location;
  }

  public flyTo(location: Location): void {
    this.map?.flyTo(new leaflet.LatLng(location.latitude, location.longitude), this.map?.getZoom());
  }

  public flyToWithZoom(location: Location, zoom: number): void {
    this.map?.setZoom(zoom);
    this.map?.flyTo(new leaflet.LatLng(location.latitude, location.longitude), this.map?.getZoom());
  }

  public moveTo(location: Location): void {
    this.map?.panTo(new leaflet.LatLng(location.latitude, location.longitude));
  }

  public moveToWithZoom(location: Location, zoom: number): void {
    this.map?.setZoom(zoom);
    this.map?.panTo(new leaflet.LatLng(location.latitude, location.longitude), this.map?.getZoom());
  }

  public setUserMarker(location: Location) {
    if (undefined === this.userMarker) {
      this.userMarker = leaflet.marker([location.latitude, location.longitude], { icon: userMarker, zIndexOffset: 0 }).addTo(this.map);
    } else {
      this.userMarker?.setLatLng([location.latitude, location.longitude]).update();
    }
  }

  public restoreUserMarker() {
    this.userMarker?.addTo(this.map);
  }

  public removeUserMarker() {
    if (this.userMarker) {
      this.userMarker.removeFrom(this.map);
    }
  }

  public setDrawCircleMarker(value: boolean) {
    this.drawCircleMarker = value;
  }

  public setCircleMarker(location: Location) {
    this.circleMarker?.removeFrom(this.map);
    if (this.drawCircleMarker) {
      this.circleMarker = leaflet.circleMarker([location.latitude, location.longitude]).addTo(this.map);
    }
  }

  public drawSearchRectange(location: Location) {
    let plusCodeArea: PlusCodeArea = this.geolocationService.getGridFromPlusCode(this.geolocationService.getPlusCodeBasedOnMapZoom(this.location, this.map?.getZoom()));
    let bounds = [[plusCodeArea.latitudeLo, plusCodeArea.longitudeLo], [plusCodeArea.latitudeHi, plusCodeArea.longitudeHi]];
    this.searchRectangle.setBounds(bounds);
  }

  public getSearchRectangeCenter(location: Location): number[] {
    let plusCodeArea: PlusCodeArea = this.geolocationService.getGridFromPlusCode(this.geolocationService.getPlusCodeBasedOnMapZoom(this.location, this.map?.getZoom()));
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
          let markerForPublicMessage: leaflet.Marker = leaflet.marker([markerLocation.location.latitude, markerLocation.location.longitude], { icon: messageMarker, zIndexOffset: 20 })
          markerForPublicMessage.on('click', ($event: leaflet.LeafletMouseEvent) => {
            this.drawCircleMarker = true;
            this.setCircleMarker({
              latitude: markerLocation.location.latitude,
              longitude: markerLocation.location.longitude,
              plusCode: markerLocation.location.plusCode
            });
            this.drawCircleMarker = false;
            this.showDataFromMarker(markerLocation);
          });
          this.messageMarkers.push(markerForPublicMessage)
          break;
        case MarkerType.PRIVATE_NOTE:
          let markerForPrivateNote: leaflet.Marker = leaflet.marker([markerLocation.location.latitude, markerLocation.location.longitude], { icon: noteMarker, zIndexOffset: 15 })
          markerForPrivateNote.on('click', ($event: leaflet.LeafletMouseEvent) => {
            this.drawCircleMarker = true;
            this.setCircleMarker({
              latitude: markerLocation.location.latitude,
              longitude: markerLocation.location.longitude,
              plusCode: markerLocation.location.plusCode
            });
            this.drawCircleMarker = false;
            this.showDataFromMarker(markerLocation);
          });
          this.messageMarkers.push(markerForPrivateNote)
          break;
        case MarkerType.MULTI:
          let markerMulti: leaflet.Marker = leaflet.marker([markerLocation.location.latitude, markerLocation.location.longitude], { icon: multiMarker, zIndexOffset: 5 })
          markerMulti.on('click', ($event: leaflet.LeafletMouseEvent) => {
            this.drawCircleMarker = true;
            this.setCircleMarker({
              latitude: markerLocation.location.latitude,
              longitude: markerLocation.location.longitude,
              plusCode: markerLocation.location.plusCode
            });
            this.drawCircleMarker = false;
            this.showDataFromMarker(markerLocation);
          });
          this.messageMarkers.push(markerMulti)
          break;
      }
    })
    // add to map
    if (undefined != this.map) {
      this.messageMarkers?.forEach((marker) => marker.addTo(this.map));
    }
  }

  private showDataFromMarker(markerLocation: MarkerLocation) {
    this.markerClickEvent.emit(markerLocation);
  }

}
