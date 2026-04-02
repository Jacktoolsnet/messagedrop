import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { TranslocoPipe } from '@jsverse/transloco';
import { Location } from '../../../interfaces/location';
import { Place } from '../../../interfaces/place';
import { PlaceService } from '../../../services/place.service';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';

@Component({
  selector: 'app-contact-chatroom-place-select-dialog',
  standalone: true,
  imports: [
    DialogHeaderComponent,
    MatDialogContent,
    MatDialogActions,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    TranslocoPipe
  ],
  templateUrl: './contact-chatroom-place-select-dialog.component.html',
  styleUrl: './contact-chatroom-place-select-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContactChatroomPlaceSelectDialogComponent {
  private readonly placeService = inject(PlaceService);
  private readonly dialogRef = inject(MatDialogRef<ContactChatroomPlaceSelectDialogComponent, Location>);

  readonly places = this.placeService.sortedPlacesSignal;
  readonly hasPlaces = computed(() => this.places().length > 0);

  select(place: Place): void {
    this.dialogRef.close({ ...place.location });
  }

  close(): void {
    this.dialogRef.close();
  }
}
