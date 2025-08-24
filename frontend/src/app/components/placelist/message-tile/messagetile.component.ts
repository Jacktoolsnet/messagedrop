import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { GetMessageResponse } from '../../../interfaces/get-message-response';
import { Message } from '../../../interfaces/message';
import { Place } from '../../../interfaces/place';
import { MessageService } from '../../../services/message.service';

@Component({
  selector: 'app-message-tile',
  imports: [
    CommonModule,
    MatIcon,
    MatButtonModule
  ],
  templateUrl: './messagetile.component.html',
  styleUrl: './messagetile.component.css'
})

export class MessageTileComponent implements OnInit, OnDestroy {
  @Input() place!: Place;
  readonly placeMessages = signal<Message[]>([]);
  readonly allPlaceMessages = signal<Message[]>([]);

  constructor(
    private messageService: MessageService,
    private matDialog: MatDialog
  ) { }

  ngOnInit(): void {
    this.messageService.getByBoundingBox(this.place.boundingBox, false)
      .subscribe({
        next: (response: GetMessageResponse) => {
          if (response.status === 200) {
            this.allPlaceMessages.set(this.messageService.mapRawMessages(response.rows));
            const visibleMessages = this.allPlaceMessages()
              .filter(m => m.message?.trim() !== '')  // Only messages with content
              .slice(0, 3);                          // Maximum 3 messages
            this.placeMessages.set(visibleMessages);
          }
        },
        error: (err) => { }
      });
  }

  ngOnDestroy(): void { }
}
