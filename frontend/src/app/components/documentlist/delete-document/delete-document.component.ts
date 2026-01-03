import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-delete-document-dialog',
  imports: [MatButtonModule, MatDialogActions, MatDialogClose, MatDialogTitle, MatDialogContent, TranslocoPipe],
  templateUrl: './delete-document.component.html',
  styleUrl: './delete-document.component.css',
  standalone: true
})
export class DeleteDocumentComponent {
  readonly dialogRef = inject(MatDialogRef<DeleteDocumentComponent>);
}
