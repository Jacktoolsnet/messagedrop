
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslocoPipe } from '@jsverse/transloco';
import { HelpDialogService } from '../../utils/help-dialog/help-dialog.service';

@Component({
  selector: 'app-override-exif-data',
  imports: [FormsModule, MatButtonModule, MatSlideToggleModule, MatDialogActions, MatDialogClose, MatDialogContent, MatIcon, TranslocoPipe],
  templateUrl: './override-exif-data.component.html',
  styleUrl: './override-exif-data.component.css',
  standalone: true
})
export class OverrideExifDataComponent {
  readonly dialogRef = inject(MatDialogRef<OverrideExifDataComponent>);
  readonly data = inject<{ previewUrl?: string; fileName?: string }>(MAT_DIALOG_DATA);
  readonly help = inject(HelpDialogService);
  applyToAll = true;
}
