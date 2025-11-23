import { CommonModule } from '@angular/common';
import { Component, inject, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

@Component({
  selector: 'app-override-exif-data',
  imports: [CommonModule, FormsModule, MatButtonModule, MatSlideToggleModule, MatDialogActions, MatDialogClose, MatDialogTitle, MatDialogContent],
  templateUrl: './override-exif-data.component.html',
  styleUrl: './override-exif-data.component.css',
  standalone: true
})
export class OverrideExifDataComponent {
  readonly dialogRef = inject(MatDialogRef<OverrideExifDataComponent>);
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { previewUrl?: string; fileName?: string },
  ) { }
  applyToAll = true;
}
