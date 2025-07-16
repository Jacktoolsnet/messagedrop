import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AppService } from '../../../services/app.service';
import { StyleService } from '../../../services/style.service';
import { UserService } from '../../../services/user.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent {
  private maxFileSize = 5 * 1024 * 1024; // 5MB

  private oriName: string | undefined = undefined;
  private oriBase64Avatar: string | undefined = undefined;
  private oriDefaultStyle: string | undefined = undefined;
  private oriDefaultTheme: string | undefined = undefined;

  constructor(
    private appService: AppService,
    public userService: UserService,
    private styleService: StyleService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<ProfileComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {}
  ) {
    this.oriName = this.userService.getProfile().name;
    this.oriBase64Avatar = this.userService.getProfile().base64Avatar
    this.oriDefaultStyle = this.userService.getProfile().defaultStyle;
  }

  onAbortClick(): void {
    if (undefined != this.oriName) {
      this.userService.getProfile().name = this.oriName;
    }
    if (undefined != this.oriBase64Avatar) {
      this.userService.getProfile().base64Avatar = this.oriBase64Avatar;
    }
    if (undefined != this.oriDefaultStyle) {
      this.userService.getProfile().defaultStyle = this.oriDefaultStyle;
    }
    this.dialogRef.close();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.snackBar.open('Please select a valid image file.', 'OK', { duration: 2000 });
      return;
    }

    if (file.size > this.maxFileSize) {
      this.snackBar.open('The image is too large. Maximum allowed size is 5MB.', 'OK', { duration: 2000 });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      this.userService.getProfile().base64Avatar = (e.target as FileReader).result as string;
    };
    reader.onerror = () => {
      this.snackBar.open('Error reading the file.', 'OK', { duration: 2000 });
    };

    reader.readAsDataURL(file);
  }

  deleteAvatar(): void {
    this.userService.getProfile().base64Avatar = '';
  }

  showPolicy(): void {
    this.snackBar.open('Your profile name and avatar are stored locally on your device.', 'OK', {
      duration: 4000
    });
  }

  changeDefaultStyle(): void {
    this.userService.getProfile().defaultStyle = this.styleService.getRandomStyle();
  }
}