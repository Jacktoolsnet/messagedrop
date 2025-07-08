import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Contact } from '../../../interfaces/contact';
import { SocketioService } from '../../../services/socketio.service';

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
    MatIconModule
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ContactProfileComponent {
  public contact!: Contact;
  public joinedUserRoom = false;
  private maxFileSize = 5 * 1024 * 1024; // 5MB

  constructor(
    private socketioService: SocketioService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<ContactProfileComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { contact: Contact }
  ) {
    this.contact = this.data.contact;
    this.joinedUserRoom = this.socketioService.hasJoinedUserRoom();
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
      this.contact.base64Avatar = (e.target as FileReader).result as string;
    };
    reader.onerror = () => {
      this.snackBar.open('Error reading the file.', 'OK', { duration: 2000 });
    };

    reader.readAsDataURL(file);
  }

  deleteAvatar(): void {
    this.contact.base64Avatar = undefined;
  }

  showPolicy(): void {
    this.snackBar.open(
      'The contact profile ID and subscription are stored on the server. Name and avatar remain local.',
      'OK', { duration: 4000 }
    );
  }

  getProfileFromContact(contact: Contact): void {
    if (!this.joinedUserRoom) {
      this.socketioService.getSocket().emit('user:joinUserRoom', contact.userId);
    }
    this.socketioService.receiveProfileForContactEvent(contact);
    this.socketioService.getSocket().emit('contact:requestProfile', contact);
    this.dialogRef.close();

    this.snackBar.open('Profile request sent.', '', {
      duration: 1500,
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
  }
}