import { Component, AfterViewInit , Input, Output, OnChanges, SimpleChanges, EventEmitter} from '@angular/core';
import { MapService } from '../../services/map.service';
import { Location } from '../../interfaces/location';
import { Message } from '../../interfaces/message';


@Component({
  selector: 'app-map',
  standalone: true,
  imports: [],
  templateUrl: './map.component.html',
  styleUrl: './map.component.css'
})
export class MapComponent implements AfterViewInit, OnChanges {
  // The members of location are used for change detection
  @Input() location: Location = { latitude: 0, longitude: 0, zoom: 19, plusCode: ''};
  @Input() messages: Message[] = [];
  @Output() clickEvent = new EventEmitter<Location>();
  @Output() moveEndEvent = new EventEmitter<Location>();
  @Output() markerClickEvent = new EventEmitter<Location>();

  ngOnChanges(changes: SimpleChanges) {
    this.mapService.setMessagesPin(this.messages);
  }

  constructor(private mapService: MapService) { }

  ngAfterViewInit(): void { 
    this.mapService.initMap(this.location, this.clickEvent, this.moveEndEvent, this.markerClickEvent);
  }
}


