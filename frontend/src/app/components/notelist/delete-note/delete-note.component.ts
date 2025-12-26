import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-deletenote',
  imports: [MatButtonModule, MatDialogActions, MatDialogClose, MatDialogTitle, MatDialogContent, TranslocoPipe],
  templateUrl: './delete-note.component.html',
  styleUrl: './delete-note.component.css'
})
export class DeleteNoteComponent {
  readonly dialogRef = inject(MatDialogRef<DeleteNoteComponent>);
}
