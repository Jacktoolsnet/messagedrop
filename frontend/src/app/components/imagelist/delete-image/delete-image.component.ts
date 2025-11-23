import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';

@Component({
  selector: 'app-delete-image-dialog',
  imports: [MatButtonModule, MatDialogActions, MatDialogClose, MatDialogTitle, MatDialogContent],
  templateUrl: './delete-image.component.html',
  styleUrl: './delete-image.component.css',
  standalone: true
})
export class DeleteImageComponent {
  readonly dialogRef = inject(MatDialogRef<DeleteImageComponent>);
}
