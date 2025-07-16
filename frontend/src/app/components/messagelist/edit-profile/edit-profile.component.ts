import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Profile } from '../../../interfaces/profile';

@Component({
  selector: 'app-edit-user',
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
  templateUrl: './edit-profile.component.html',
  styleUrl: './edit-profile.component.css'
})
export class EditProfileComponent {
  public profile!: Profile;
  public userId!: string;

  constructor(
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<EditProfileComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { profile: Profile, userId: string }) {
    if (data.profile) {
      this.profile = data.profile;
    } else {
      this.profile = {
        name: '',
        base64Avatar: ''
      };
    }
    this.userId = data.userId;
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
    this.profile.base64Avatar = event.target.result;
  }

  handleFileError(event: any) {

  }

  deleteAvatar() {
    this.profile.base64Avatar = '';
  }

  public showPolicy() {
    this.snackBar.open(`Profile name and avatar is stored on the device.`, 'OK', {});
  }
}
