import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';

@Component({
  selector: 'app-deletenote',
  imports: [MatButtonModule, MatDialogActions, MatDialogClose, MatDialogTitle, MatDialogContent],
  templateUrl: './delete-image.component.html',
  styleUrl: './delete-image.component.css'
})
export class DeleteImageComponent {
  readonly dialogRef = inject(MatDialogRef<DeleteImageComponent>);
}
