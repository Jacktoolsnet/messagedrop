
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

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      this.contact.chatBackgroundImage = (e.target as FileReader).result as string;
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
