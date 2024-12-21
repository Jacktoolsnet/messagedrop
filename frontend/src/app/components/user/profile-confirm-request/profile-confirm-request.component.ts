import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogTitle, MatDialogContent, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Contact } from '../../../interfaces/contact';

@Component({
    selector: 'app-deleteuser',
    imports: [MatButtonModule, MatDialogActions, MatDialogClose, MatDialogTitle, MatDialogContent],
    templateUrl: './profile-confirm-request.component.html',
    styleUrl: './profile-confirm-request.component.css'
})
export class ProfileConfirmRequestComponent {
  public contact: Contact;

  constructor(
    public dialogRef: MatDialogRef<ProfileConfirmRequestComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { contact: Contact }
  ) { 
    this.contact = data.contact;
  }
}
