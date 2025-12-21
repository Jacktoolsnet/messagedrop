import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';

@Component({
  selector: 'app-delete-contact-message',
  imports: [MatButtonModule, MatDialogActions, MatDialogClose, MatDialogTitle, MatDialogContent],
  templateUrl: './delete-contact-message.component.html',
  styleUrl: './delete-contact-message.component.css'
})
export class DeleteContactMessageComponent {
  readonly dialogRef = inject(MatDialogRef<DeleteContactMessageComponent>);
}
