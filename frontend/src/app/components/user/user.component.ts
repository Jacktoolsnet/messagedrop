import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { QRCodeComponent } from 'angularx-qrcode';
import { User } from '../../interfaces/user';

@Component({
  selector: 'app-user',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    MatButtonModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatIcon,
    CommonModule,
    QRCodeComponent
  ],
  templateUrl: './user.component.html',
  styleUrl: './user.component.css'
})
export class UserComponent {
  private snackBarRef: any;
  public user?: User;
  public connectHint: string = ``;

  constructor(
    private snackBar: MatSnackBar,
    @Inject(MAT_DIALOG_DATA) public data: { user: User }) {
    this.user = data.user;
  }

  public showPolicy() {
    this.snackBarRef = this.snackBar.open(`User id, public encryption key, public signing key, number of messages, number of blocked messages, user status, last sign of life, subscription and connect hint is saved on our server. This informations are essential for the functionality of the application.`, 'OK', {});
  }

}
