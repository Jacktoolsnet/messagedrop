import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, MAT_DIALOG_DATA, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { User } from '../../interfaces/user';
import { EditUserComponent } from '../messagelist/edit-user/edit-user.component';
import { DeleteUserComponent } from './delete-user/delete-user.component';
import { UserService } from '../../services/user.service';
import { NoteService } from '../../services/note.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-user',
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
  templateUrl: './user.component.html',
  styleUrl: './user.component.css'
})
export class UserComponent {
  private snackBarRef: any;
  public user?: User;
  
  constructor(
    private snackBar: MatSnackBar, 
    public dialog: MatDialog,
    private userService: UserService,
    private noteService: NoteService,
    public dialogRef: MatDialogRef<EditUserComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {user: User}) {
      this.user = data.user;
    }

    public copyToClipboard() {
      if (this.user){
        navigator.clipboard.writeText(this.user.id);
        this.snackBarRef = this.snackBar.open(`Your user ID has been copied to the clipboard. Please share it only with people you trust.` , 'OK',  {});
      }      
    }
}
