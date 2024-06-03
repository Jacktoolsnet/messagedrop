import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { EditUserComponent } from '../../messagelist/edit-user/edit-user.component';
import { User } from '../../../interfaces/user';

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

  constructor(public dialogRef: MatDialogRef<EditUserComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {user: User}) {
      this.user = data.user;
    }

    onAbortClick(): void {
      this.dialogRef.close();
    }

    onFileSelected(event: any) {
      const file : File = event.target.files[0];

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

    deleteAvatar(){
      this.user.base64Avatar = '';
    }
}
