import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-delete-contact-message',
  imports: [MatButtonModule, MatDialogActions, MatDialogClose, MatDialogTitle, MatDialogContent, TranslocoPipe],
  templateUrl: './delete-contact-message.component.html',
  styleUrl: './delete-contact-message.component.css'
})
export class DeleteContactMessageComponent {
  readonly dialogRef = inject(MatDialogRef<DeleteContactMessageComponent>);
}
