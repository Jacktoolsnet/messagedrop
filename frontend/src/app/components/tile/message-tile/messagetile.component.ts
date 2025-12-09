
import { Component, computed, Input, OnDestroy, OnInit, signal, WritableSignal, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { GetMessageResponse } from '../../../interfaces/get-message-response';
import { Message } from '../../../interfaces/message';
import { Place } from '../../../interfaces/place';
import { GeolocationService } from '../../../services/geolocation.service';
import { MessageService } from '../../../services/message.service';
import { MessagelistComponent } from '../../messagelist/messagelist.component';

@Component({
  selector: 'app-message-tile',
  imports: [
    MatIcon,
    MatButtonModule
],
  templateUrl: './messagetile.component.html',
  styleUrl: './messagetile.component.css'
})

export class MessageTileComponent implements OnInit, OnDestroy {
  @Input() place!: Place;
  readonly allPlaceMessages: WritableSignal<Message[]> = signal<Message[]>([]);

  readonly placeMessages = computed(() =>
    this.allPlaceMessages()
      .filter(m => m.message?.trim() !== '')
      .slice(0, 3)
  );

  private readonly messageService = inject(MessageService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly matDialog = inject(MatDialog);

  ngOnInit(): void {
    this.messageService.getByBoundingBox(this.place.boundingBox, false)
      .subscribe({
        next: (response: GetMessageResponse) => {
          if (response.status === 200) {
            this.allPlaceMessages.set(this.messageService.mapRawMessages(response.rows));
          }
        },
        error: () => {
          this.allPlaceMessages.set([]);
        }
      });
  }

  openMessageDialog(): void {
    this.matDialog.open(MessagelistComponent, {
      panelClass: 'NoteListDialog',
      closeOnNavigation: true,
      data: { location: this.geolocationService.getCenterOfBoundingBox(this.place.boundingBox!), messageSignal: this.allPlaceMessages },
      minWidth: '20vw',
      maxWidth: '95vw',
      width: 'auto',
      maxHeight: 'none',
      height: 'auto',
      hasBackdrop: true,
      autoFocus: false
    });
  }

  ngOnDestroy(): void {
    this.allPlaceMessages.set([]);
  }
}
