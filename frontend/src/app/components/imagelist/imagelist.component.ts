import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialog, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MasonryItemDirective } from '../../directives/masonry-item.directive';
import { LocalImage } from '../../interfaces/local-image';
import { Location } from '../../interfaces/location';
import { User } from '../../interfaces/user';
import { GeolocationService } from '../../services/geolocation.service';
import { LocalImageService } from '../../services/local-image.service';
import { MapService } from '../../services/map.service';
import { SharedContentService } from '../../services/shared-content.service';
import { UserService } from '../../services/user.service';
import { DeleteImageComponent } from './delete-image/delete-note.component';

@Component({
  selector: 'app-notelist',
  imports: [
    MatBadgeModule,
    MatCardModule,
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogContent,
    MatIcon,
    FormsModule,
    MatFormFieldModule,
    MatMenuModule,
    MatInputModule,
    MasonryItemDirective
  ],
  templateUrl: './imagelist.component.html',
  styleUrl: './imagelist.component.css',
  standalone: true
})
export class ImagelistComponent {
  private readonly dialogData = inject<{ location: Location; imagesSignal: WritableSignal<LocalImage[]> }>(MAT_DIALOG_DATA);
  public readonly userService = inject(UserService);
  private readonly localImageService = inject(LocalImageService);
  private readonly mapService = inject(MapService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly sharedContentService = inject(SharedContentService);
  public readonly dialogRef = inject(MatDialogRef<ImagelistComponent>);
  public readonly dialog = inject(MatDialog);

  readonly hasNotes = computed(() => this.imagesSignal().length > 0);
  public user: User | undefined = this.userService.getUser();
  public imagesSignal: WritableSignal<LocalImage[]> = this.dialogData.imagesSignal;
  private location: Location = this.dialogData.location;

  constructor() {
    effect(() => {
      this.imagesSignal();   // reactive read
      if (this.dialogData.imagesSignal) {
        this.dialogData.imagesSignal.set(this.imagesSignal());
      }
    });
  }

  goBack(): void {
    this.dialogRef.close();
  }

  flyTo(localImage: LocalImage) {
    const location = { ...localImage.location, plusCode: this.geolocationService.getPlusCode(localImage.location.latitude, localImage.location.longitude) };
    this.mapService.setCircleMarker();
    this.mapService.flyTo(location);
    this.dialogRef.close();
  }

  navigateToNoteLocation(localImage: LocalImage) {
    this.localImageService.navigateToNoteLocation(this.userService.getUser(), localImage);
  }

  deleteImage(image: LocalImage) {
    const dialogRef = this.dialog.open(DeleteImageComponent);
    dialogRef.afterClosed().subscribe(async result => {
      if (result) {
        await this.localImageService.deleteImage(image);
        const updatedNotes = this.imagesSignal().filter(n => n.id !== image.id);
        this.imagesSignal.set(updatedNotes);
      }
    });
  }

}
