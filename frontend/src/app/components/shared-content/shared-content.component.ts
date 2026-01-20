
import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogModule, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { Location } from '../../interfaces/location';
import { Multimedia } from '../../interfaces/multimedia';
import { MapService } from '../../services/map.service';
import { SharedContentService } from '../../services/shared-content.service';
import { ShowmultimediaComponent } from '../multimedia/showmultimedia/showmultimedia.component';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';

@Component({
  standalone: true,
  selector: 'app-shared-content',
  imports: [
    MatDialogContent,
    MatButtonModule,
    MatDialogTitle,
    MatDialogActions,
    MatDialogClose,
    ShowmultimediaComponent,
    MatDialogModule,
    MatIcon,
    TranslocoPipe
],
  templateUrl: './shared-content.component.html',
  styleUrl: './shared-content.component.css'
})

export class SharedContentComponent implements OnInit {
  private readonly mapService = inject(MapService);
  private readonly sharedContentService = inject(SharedContentService);
  private readonly dialogRef = inject(MatDialogRef<SharedContentComponent>);
  readonly help = inject(HelpDialogService);
  readonly data = inject<{ multimedia?: Multimedia; location?: Location }>(MAT_DIALOG_DATA);

  public multimedia: Multimedia | undefined = this.data.multimedia;
  public location: Location | undefined = this.data.location;

  public async ngOnInit(): Promise<void> {
    if (this.data.location) {
      this.mapService.moveToWithZoom(this.data.location, 17);
    }
  }

  public deleteSharedContent(): void {
    if (this.multimedia) {
      this.sharedContentService.deleteSharedContent('last');
      this.sharedContentService.deleteSharedContent('lastMultimedia');
    }
    this.dialogRef.close();
  }

  public deleteSharedLocation(): void {
    if (this.location) {
      this.sharedContentService.deleteSharedContent('last');
      this.sharedContentService.deleteSharedContent('lastLocation');
    }
  }
}
