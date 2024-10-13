import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Contact } from '../../../interfaces/contact';
import { SocketioService } from '../../../services/socketio.service';

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
export class ContactProfileComponent {
  private snackBarRef: any;
  public contact!: Contact;
  public joinedUserRoom: boolean = false;

  constructor(
    private socketioService: SocketioService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<ContactProfileComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { contact: Contact }) {
    this.contact = data.contact;
    this.joinedUserRoom = this.socketioService.hasJoinedUserRoom();
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
    this.contact.base64Avatar = event.target.result;
  }

  handleFileError(event: any) {

  }

  deleteAvatar() {
    this.contact.base64Avatar = undefined;
  }

  public showPolicy() {
    this.snackBarRef = this.snackBar.open(`Profile name and avatar is stored on the device.`, 'OK', {});
  }

  public getProfileFromContact(contact: Contact) {
    console.log("getProfileFromContact start")
    if (!this.joinedUserRoom){
      console.log("getProfileFromContact joining")
      this.socketioService.getSocket().emit('user:joinUserRoom', contact.userId);
    }
    console.log("getProfileFromContact requesting")
    this.socketioService.receiveProfileForContactEvent(contact);
    this.socketioService.getSocket().emit('contact:requestProfile', contact);
  }
}
