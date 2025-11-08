import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
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
  templateUrl: './message-profile.component.html',
  styleUrl: './message-profile.component.css'
})
export class MessageProfileComponent {
  private readonly snackBar = inject(MatSnackBar);
  readonly dialogRef = inject(MatDialogRef<MessageProfileComponent>);
  readonly data = inject<{ profile: Profile; userId: string }>(MAT_DIALOG_DATA);

  public profile: Profile;
  public userId: string;
  private readonly oriProfile: Profile;

  constructor() {
    this.profile = this.data.profile ?? { name: '', base64Avatar: '' };
    this.oriProfile = structuredClone(this.profile);
    this.userId = this.data.userId;
  }

  onAbortClick(): void {
    Object.assign(this.profile, this.oriProfile);
    this.dialogRef.close();
  }

  onApplyClick(): void {
    Object.assign(this.data.profile, this.profile);
    this.dialogRef.close();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = this.handleFile.bind(this);
    reader.onerror = this.handleFileError.bind(this);
  }

  handleFile(event: ProgressEvent<FileReader>): void {
    const result = event.target?.result;
    if (typeof result === 'string') {
      this.profile.base64Avatar = result;
    }
  }

  handleFileError(): void {
    this.snackBar.open('Could not read the selected file. Please try again.', 'OK', { duration: 2500 });
  }

  deleteAvatar() {
    this.profile.base64Avatar = '';
  }

  public showPolicy() {
    this.snackBar.open(`Profile name and avatar is stored on the device.`, 'OK', {});
  }
}
