import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-delete-image-dialog',
  imports: [MatButtonModule, MatDialogActions, MatDialogClose, MatDialogTitle, MatDialogContent, MatIcon, TranslocoPipe],
  templateUrl: './delete-image.component.html',
  styleUrl: './delete-image.component.css',
  standalone: true
})
export class DeleteImageComponent {
  readonly dialogRef = inject(MatDialogRef<DeleteImageComponent>);
}
