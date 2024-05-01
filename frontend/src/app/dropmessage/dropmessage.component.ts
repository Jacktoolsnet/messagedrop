import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, MatDialogModule, MatDialogContainer } from '@angular/material/dialog';

import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { User } from '../interfaces/user';


@Component({
  selector: 'app-dropmessage',
  standalone: true,
  imports: [
    MatDialogContainer,
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
    MatInputModule],
  templateUrl: './dropmessage.component.html',
  styleUrl: './dropmessage.component.css'
})
export class DropmessageComponent {

  public message: string = 'Messagedrop rocks!';

  constructor(
    public dialogRef: MatDialogRef<DropmessageComponent>
  ) {}

  onNoClick(): void {
    this.dialogRef.close(this.message);
  }
}
