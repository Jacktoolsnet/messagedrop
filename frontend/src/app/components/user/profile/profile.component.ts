import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { User } from '../../../interfaces/user';
import { MatSnackBar } from '@angular/material/snack-bar';
import { StyleService } from '../../../services/style.service';

@Component({
  selector: 'app-profile',
  standalone: true,
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
  public user!: User;

  constructor(
    private style: StyleService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<ProfileComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { user: User }) {
    this.user = data.user;
  }

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
    this.user.base64Avatar = event.target.result;
  }

  handleFileError(event: any) {

  }

  deleteAvatar() {
    this.user.base64Avatar = '';
  }

  public showPolicy() {
    this.snackBar.open(`Profile name and avatar is stored on the device.`, 'OK', {});
  }

  public changeDefaultStyle(){
    this.user.defaultStyle = this.style.getRandomStyle();
  }
}
