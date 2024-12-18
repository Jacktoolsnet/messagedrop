import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogTitle, MatDialogContent, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RelatedUser } from '../../../interfaces/related-user';
import { MatIcon } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-edit-user',
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
  templateUrl: './edit-user.component.html',
  styleUrl: './edit-user.component.css'
})
export class EditUserComponent {
  public relatedUser!: RelatedUser;

  constructor(
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<EditUserComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {relatedUser: RelatedUser}) {
      this.relatedUser = data.relatedUser;
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
      this.relatedUser.base64Avatar = event.target.result;
    }

    handleFileError(event: any) {
    
    }

    deleteAvatar(){
      this.relatedUser.base64Avatar = '';
    }

    public showPolicy() {
      this.snackBar.open(`Profile name and avatar is stored on the device.`, 'OK', {});
    }
}
