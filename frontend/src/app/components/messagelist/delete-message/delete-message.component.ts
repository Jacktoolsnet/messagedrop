import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';

@Component({
  selector: 'app-deletemessage',
  imports: [MatButtonModule, MatDialogActions, MatDialogClose, MatDialogTitle, MatDialogContent],
  templateUrl: './delete-message.component.html',
  styleUrl: './delete-message.component.css'
})
export class DeleteMessageComponent {
  readonly dialogRef = inject(MatDialogRef<DeleteMessageComponent>);
}
