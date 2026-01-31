import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';

@Component({
  selector: 'app-delete-document-dialog',
  imports: [
    DialogHeaderComponent,MatButtonModule, MatDialogActions, MatDialogClose, MatDialogContent, MatIcon, TranslocoPipe],
  templateUrl: './delete-document.component.html',
  styleUrl: './delete-document.component.css',
  standalone: true
})
export class DeleteDocumentComponent {
  readonly dialogRef = inject(MatDialogRef<DeleteDocumentComponent>);
}
