import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from "@angular/material/icon";
import { TranslocoPipe } from '@jsverse/transloco';
import { Contact } from '../../../interfaces/contact';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';

@Component({
  selector: 'app-deleteuser',
  imports: [
    DialogHeaderComponent,MatButtonModule, MatDialogActions, MatDialogClose, MatDialogContent, TranslocoPipe, MatIcon],
  templateUrl: './profile-confirm-request.component.html',
  styleUrl: './profile-confirm-request.component.css'
})
export class ProfileConfirmRequestComponent {
  readonly dialogRef = inject(MatDialogRef<ProfileConfirmRequestComponent>);
  readonly data = inject<{ contact: Contact }>(MAT_DIALOG_DATA);
  public contact: Contact = this.data.contact;
}
