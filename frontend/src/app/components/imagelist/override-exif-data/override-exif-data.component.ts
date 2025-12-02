import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

@Component({
  selector: 'app-override-exif-data',
  imports: [CommonModule, FormsModule, MatButtonModule, MatSlideToggleModule, MatDialogActions, MatDialogClose, MatDialogContent],
  templateUrl: './override-exif-data.component.html',
  styleUrl: './override-exif-data.component.css',
  standalone: true
})
export class OverrideExifDataComponent {
  readonly dialogRef = inject(MatDialogRef<OverrideExifDataComponent>);
  readonly data = inject<{ previewUrl?: string; fileName?: string }>(MAT_DIALOG_DATA);
  applyToAll = true;
}
