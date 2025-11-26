import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Mode } from '../../../interfaces/mode';
import { Place } from '../../../interfaces/place';

@Component({
  selector: 'app-place',
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogActions,
    MatDialogClose,
    MatDialogTitle,
    MatDialogContent,
    MatIcon,
    FormsModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './place-settings.component.html',
  styleUrl: './place-settings.component.css'
})
export class PlaceProfileComponent {

  private maxFileSize = 5 * 1024 * 1024; // 5MB
  private oriName: string | undefined = undefined;
  private oriBase64Avatar: string | undefined = undefined;
  private oriIcon: string | undefined = undefined;

  readonly dialogRef = inject(MatDialogRef<PlaceProfileComponent>);
  private readonly snackBar = inject(MatSnackBar);
  readonly data = inject<{ mode: Mode, place: Place }>(MAT_DIALOG_DATA);

  constructor() {
    this.oriName = this.data.place.name;
    this.oriBase64Avatar = this.data.place.base64Avatar;
    this.oriIcon = this.data.place.icon;
  }

  onApplyClick(): void {
    this.dialogRef.close();
  }

  onAbortClick(): void {
    if (undefined != this.oriName) {
      this.data.place.name = this.oriName;
    }
    if (undefined != this.oriBase64Avatar) {
      this.data.place.base64Avatar = this.oriBase64Avatar;
    }
    if (undefined != this.oriIcon) {
      this.data.place.icon = this.oriIcon;
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
      this.data.place.base64Avatar = (e.target as FileReader).result as string;
    };
    reader.onerror = () => {
      this.snackBar.open('Error reading the file.', 'OK', { duration: 2000 });
    };

    reader.readAsDataURL(file);
  }

  deleteAvatar() {
    this.data.place.base64Avatar = '';
  }

  public showPolicy() {
    this.snackBar.open(`Place id, place name (hashed), the added locations and the subscribed flag is saved on our server. The readable name and the avatar is saved on your device.`, 'OK', {});
  }

}
