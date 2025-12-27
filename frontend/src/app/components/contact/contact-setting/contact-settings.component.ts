
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { Contact } from '../../../interfaces/contact';
import { TileSetting } from '../../../interfaces/tile-settings';
import { ContactService } from '../../../services/contact.service';
import { SocketioService } from '../../../services/socketio.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { TileSettingsComponent } from '../../tile/tile-settings/tile-settings.component';

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
    TranslocoPipe
  ],
  templateUrl: './contact-settings.component.html',
  styleUrl: './contact-settings.component.css'
})
export class ContactSettingsComponent {
  private readonly socketioService = inject(SocketioService);
  private readonly contactService = inject(ContactService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translation = inject(TranslationHelperService);
  readonly dialogRef = inject(MatDialogRef<ContactSettingsComponent>);
  private readonly dialog = inject(MatDialog);
  readonly data = inject<{ contact: Contact }>(MAT_DIALOG_DATA);

  public contact: Contact = this.data.contact;
  public joinedUserRoom = this.socketioService.hasJoinedUserRoom();
  private readonly maxFileSize = 5 * 1024 * 1024; // 5MB
  private readonly oriContact: Contact = structuredClone(this.contact);

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

  deleteAvatar(): void {
    this.contact.base64Avatar = undefined;
  }

  showPolicy(): void {
    this.snackBar.open(
      this.translation.t('common.contact.profile.policy'),
      this.translation.t('common.actions.ok'),
      { duration: 4000 }
    );
  }

  getProfileFromContact(contact: Contact): void {
    if (!this.joinedUserRoom) {
      this.socketioService.getSocket().emit('user:joinUserRoom', contact.userId);
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

  openTileSettings(): void {
    const dialogRef = this.dialog.open(TileSettingsComponent, {
      width: 'auto',
      minWidth: '450px',
      maxWidth: '90vw',
      maxHeight: '90vh',
      data: { contact: this.data.contact }
    });

    dialogRef.afterClosed().subscribe((updatedSettings?: TileSetting[]) => {
      if (updatedSettings?.length) {
        this.data.contact.tileSettings = updatedSettings.map((tile: TileSetting) => ({ ...tile }));
        this.contactService.saveContactTileSettings(this.data.contact);
        this.contactService.refreshContact(this.data.contact.id);
      }
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
