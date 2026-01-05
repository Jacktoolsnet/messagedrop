
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { Contact } from '../../../interfaces/contact';
import { SocketioService } from '../../../services/socketio.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatIconModule,
    MatSliderModule,
    TranslocoPipe
  ],
  templateUrl: './contact-settings.component.html',
  styleUrl: './contact-settings.component.css'
})
export class ContactSettingsComponent {
  private readonly socketioService = inject(SocketioService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translation = inject(TranslationHelperService);
  readonly dialogRef = inject(MatDialogRef<ContactSettingsComponent>);
  readonly data = inject<{ contact: Contact }>(MAT_DIALOG_DATA);

  public contact: Contact = this.data.contact;
  readonly joinedUserRoom = this.socketioService.joinedUserRoom;
  private readonly maxFileSize = 5 * 1024 * 1024; // 5MB
  private readonly maxBackgroundBytes = 2 * 1024 * 1024; // 2MB
  private readonly maxBackgroundDimension = 1600;
  private readonly oriContact: Contact = structuredClone(this.contact);

  constructor() {
    if (this.contact.chatBackgroundTransparency == null) {
      this.contact.chatBackgroundTransparency = 40;
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.snackBar.open(
        this.translation.t('common.contact.profile.imageInvalid'),
        this.translation.t('common.actions.ok'),
        { duration: 2000 }
      );
      return;
    }

    if (file.size > this.maxFileSize) {
      this.snackBar.open(
        this.translation.t('common.contact.profile.imageTooLarge', { maxMb: 5 }),
        this.translation.t('common.actions.ok'),
        { duration: 2000 }
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      this.contact.base64Avatar = (e.target as FileReader).result as string;
    };
    reader.onerror = () => {
      this.snackBar.open(
        this.translation.t('common.contact.profile.fileReadError'),
        this.translation.t('common.actions.ok'),
        { duration: 2000 }
      );
    };

    reader.readAsDataURL(file);
  }

  onBackgroundFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.snackBar.open(
        this.translation.t('common.contact.profile.imageInvalid'),
        this.translation.t('common.actions.ok'),
        { duration: 2000 }
      );
      return;
    }

    if (file.size > this.maxFileSize) {
      this.snackBar.open(
        this.translation.t('common.contact.profile.imageTooLarge', { maxMb: 5 }),
        this.translation.t('common.actions.ok'),
        { duration: 2000 }
      );
      return;
    }

    this.resizeAndCompressImage(file, this.maxBackgroundDimension, this.maxBackgroundBytes)
      .then((dataUrl) => {
        this.contact.chatBackgroundImage = dataUrl;
        if (this.contact.chatBackgroundTransparency == null) {
          this.contact.chatBackgroundTransparency = 40;
        }
        input.value = '';
      })
      .catch((error: Error) => {
        if (error.message === 'too_large') {
          this.snackBar.open(
            this.translation.t('common.contact.profile.imageTooLarge', { maxMb: 2 }),
            this.translation.t('common.actions.ok'),
            { duration: 2000 }
          );
          return;
        }
        this.snackBar.open(
          this.translation.t('common.contact.profile.fileReadError'),
          this.translation.t('common.actions.ok'),
          { duration: 2000 }
        );
      });
  }

  deleteAvatar(): void {
    this.contact.base64Avatar = undefined;
  }

  deleteChatBackground(): void {
    this.contact.chatBackgroundImage = '';
  }

  getChatBackgroundPreviewImage(): string {
    return this.contact.chatBackgroundImage ? `url(${this.contact.chatBackgroundImage})` : 'none';
  }

  getChatBackgroundPreviewOpacity(): number {
    const transparency = this.contact.chatBackgroundTransparency ?? 40;
    const clamped = Math.min(Math.max(transparency, 0), 100);
    return 1 - clamped / 100;
  }

  private async resizeAndCompressImage(file: File, maxDimension: number, maxBytes: number): Promise<string> {
    const image = await this.loadImage(file);
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const targetWidth = Math.max(1, Math.round(image.width * scale));
    const targetHeight = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('canvas');
    }

    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

    let quality = 0.86;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    let bytes = this.estimateDataUrlBytes(dataUrl);

    while (bytes > maxBytes && quality > 0.6) {
      quality = Math.max(quality - 0.08, 0.6);
      dataUrl = canvas.toDataURL('image/jpeg', quality);
      bytes = this.estimateDataUrlBytes(dataUrl);
    }

    if (bytes > maxBytes) {
      throw new Error('too_large');
    }

    return dataUrl;
  }

  private loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('load_failed'));
      };
      image.src = url;
    });
  }

  private estimateDataUrlBytes(dataUrl: string): number {
    const base64 = dataUrl.split(',')[1] ?? '';
    return Math.floor((base64.length * 3) / 4);
  }

  showPolicy(): void {
    this.snackBar.open(
      this.translation.t('common.contact.profile.policy'),
      this.translation.t('common.actions.ok'),
      { duration: 4000 }
    );
  }

  getProfileFromContact(contact: Contact): void {
    if (!this.joinedUserRoom()) {
      this.socketioService.initUserSocketEvents();
    }
    this.socketioService.receiveProfileForContactEvent(contact);
    this.socketioService.getSocket().emit('contact:requestProfile', contact);
    this.dialogRef.close();

    this.snackBar.open(this.translation.t('common.contact.profile.requestSent'), '', {
      duration: 1500,
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
  }

  onAbortClick() {
    Object.assign(this.data.contact, this.oriContact);
    this.dialogRef.close();
  }

  onApplyClick() {
    this.dialogRef.close();
  }
}
