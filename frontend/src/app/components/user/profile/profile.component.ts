import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { StyleService } from '../../../services/style.service';
import { UserService } from '../../../services/user.service';

@Component({
  selector: 'app-profile',
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
    CommonModule
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent {

  constructor(
    public userService: UserService,
    private style: StyleService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<ProfileComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {}) { }

  onAbortClick(): void {
    this.dialogRef.close();
  }

  onFileSelected(event: any) {
    const file: File = event.target.files[0];

    if (file) {
      let reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = this.handleFile.bind(this);
      reader.onerror = this.handleFileError.bind(this);
    }
  }

  handleFile(event: any) {
    this.userService.getUser().base64Avatar = event.target.result;
  }

  handleFileError(event: any) {

  }

  deleteAvatar() {
    this.userService.getUser().base64Avatar = '';
  }

  public showPolicy() {
    this.snackBar.open(`Profile name and avatar is stored on the device.`, 'OK', {});
  }

  public changeDefaultStyle() {
    this.userService.getUser().defaultStyle = this.style.getRandomStyle();
  }
}
