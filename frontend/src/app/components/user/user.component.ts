import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarRef, SimpleSnackBar } from '@angular/material/snack-bar';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-user',
  imports: [
    MatButtonModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatIcon,
    CommonModule
  ],
  templateUrl: './user.component.html',
  styleUrl: './user.component.css'
})
export class UserComponent {
  private snackBarRef?: MatSnackBarRef<SimpleSnackBar>;
  public connectHint = '';
  readonly userService = inject(UserService);
  private readonly snackBar = inject(MatSnackBar);
  public showPolicy(): void {
    this.snackBarRef = this.snackBar.open(`User id, public encryption key, public signing key, number of messages, number of blocked messages, user status, last sign of life, subscription and connect hint is saved on our server. This informations are essential for the functionality of the application.`, 'OK', {});
  }

}
