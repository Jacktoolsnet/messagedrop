import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { Contact } from '../../../interfaces/contact';

@Component({
  selector: 'app-deleteuser',
  imports: [MatButtonModule, MatDialogActions, MatDialogClose, MatDialogTitle, MatDialogContent],
  templateUrl: './profile-confirm-request.component.html',
  styleUrl: './profile-confirm-request.component.css'
})
export class ProfileConfirmRequestComponent {
  readonly dialogRef = inject(MatDialogRef<ProfileConfirmRequestComponent>);
  readonly data = inject<{ contact: Contact }>(MAT_DIALOG_DATA);
  public contact: Contact = this.data.contact;
}
