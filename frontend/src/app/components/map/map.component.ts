import { Component, AfterViewInit , Input, Output, OnChanges, SimpleChanges, EventEmitter} from '@angular/core';
import { MapService } from '../../services/map.service';
import { Location } from '../../interfaces/location';
import { Message } from '../../interfaces/message';
import { Note } from '../../interfaces/note';


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
  @Input() notes: Note[] = [];
  @Output() clickEvent = new EventEmitter<Location>();
  @Output() moveEndEvent = new EventEmitter<Location>();
  @Output() messageMarkerClickEvent = new EventEmitter<Location>();
  @Output() noteMarkerClickEvent = new EventEmitter<Location>();

  private initFinished: boolean = false;

  ngOnChanges(changes: SimpleChanges) {
    if (undefined !== this.messages && this.initFinished) {
      this.mapService.setMessagesPin(this.messages);
    }
    if (undefined !== this.notes  && this.initFinished) {
      this.mapService.setNotesPin(this.notes);
    }
  }

  constructor(private mapService: MapService) { }

  ngAfterViewInit(): void { 
    this.mapService.initMap(this.location, this.clickEvent, this.moveEndEvent, this.messageMarkerClickEvent, this.noteMarkerClickEvent);
    if (undefined !== this.messages) {
      this.mapService.setMessagesPin(this.messages);
    }
    if (undefined !== this.notes) {
      this.mapService.setNotesPin(this.notes);
    }
    this.initFinished = true;
  }
}


