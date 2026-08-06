
import { ChangeDetectionStrategy, Component, computed, inject, Input, OnChanges, OnDestroy, signal, SimpleChanges, WritableSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { Subscription } from 'rxjs';
import { GetMessageResponse } from '../../../interfaces/get-message-response';
import { Message } from '../../../interfaces/message';
import { MultimediaType } from '../../../interfaces/multimedia-type';
import { Place } from '../../../interfaces/place';
import { GeolocationService } from '../../../services/geolocation.service';
import { MessageService } from '../../../services/message.service';
import { MessagelistComponent } from '../../messagelist/messagelist.component';

@Component({
  selector: 'app-message-tile',
  imports: [
    MatIcon,
    MatButtonModule,
    TranslocoPipe
  ],
  templateUrl: './messagetile.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './messagetile.component.css'
})

export class MessageTileComponent implements OnChanges, OnDestroy {
  @Input() place!: Place;
  @Input() radiusMeters?: number;
  @Input() showRadius = false;
  readonly allPlaceMessages: WritableSignal<Message[]> = signal<Message[]>([]);
  readonly loading = signal(false);

  readonly placeMessages = computed(() =>
    this.allPlaceMessages()
      .filter(m => m.message?.trim() !== '' || (m.multimedia?.type && m.multimedia.type !== MultimediaType.UNDEFINED))
      .slice(0, 3)
  );

  private readonly messageService = inject(MessageService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly matDialog = inject(MatDialog);
  private requestSubscription?: Subscription;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['place'] || changes['radiusMeters']) {
      this.loadMessages();
    }
  }

  private loadMessages(): void {
    if (!this.place?.boundingBox) {
      return;
    }

    this.requestSubscription?.unsubscribe();
    this.loading.set(true);
    this.allPlaceMessages.set([]);
    this.requestSubscription = this.messageService.getByBoundingBox(this.place.boundingBox, false)
      .subscribe({
        next: (response: GetMessageResponse) => {
          if (response.status === 200) {
            const messages = this.messageService.mapRawMessages(response.rows)
              .filter((message) => this.isInsideRadius(message))
              .sort((left, right) => (right.createDateTime ?? 0) - (left.createDateTime ?? 0));
            this.allPlaceMessages.set(messages);
          }
          this.loading.set(false);
        },
        error: () => {
          this.allPlaceMessages.set([]);
          this.loading.set(false);
        }
      });
  }

  private isInsideRadius(message: Message): boolean {
    if (!this.radiusMeters || this.radiusMeters <= 0) {
      return true;
    }

    const latitude = Number(message.location?.latitude);
    const longitude = Number(message.location?.longitude);
    const centerLatitude = Number(this.place.location?.latitude);
    const centerLongitude = Number(this.place.location?.longitude);
    if (![latitude, longitude, centerLatitude, centerLongitude].every(Number.isFinite)) {
      return false;
    }

    const toRadians = (value: number): number => value * Math.PI / 180;
    const latitudeDelta = toRadians(latitude - centerLatitude);
    const longitudeDelta = toRadians(longitude - centerLongitude);
    const haversine = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(toRadians(centerLatitude)) * Math.cos(toRadians(latitude))
      * Math.sin(longitudeDelta / 2) ** 2;
    const distanceMeters = 2 * 6_371_000 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
    return distanceMeters <= this.radiusMeters;
  }

  openMessageDialog(): void {
    this.matDialog.open(MessagelistComponent, {
      panelClass: 'MessageListDialog',
      closeOnNavigation: true,
      data: { location: this.geolocationService.getCenterOfBoundingBox(this.place.boundingBox!), messageSignal: this.allPlaceMessages },
      width: 'min(900px, 95vw)',
      maxWidth: '95vw',
      maxHeight: '95vh',
      height: 'auto',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
  }

  ngOnDestroy(): void {
    this.requestSubscription?.unsubscribe();
    this.allPlaceMessages.set([]);
  }
}
