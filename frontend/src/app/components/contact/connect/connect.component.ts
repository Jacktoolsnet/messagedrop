import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Contact } from '../../../interfaces/contact';
import { Mode } from '../../../interfaces/mode';

@Component({
  selector: 'app-contact',
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
  templateUrl: './connect.component.html',
  styleUrl: './connect.component.css'
})
export class ConnectComponent implements OnInit {
  public connectId: String = '';

  constructor(
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<ConnectComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { mode: Mode, contact: Contact, connectId: string }
  ) { }

  ngOnInit(): void {
  }

  onApplyClick(): void {
    this.dialogRef.close(this.data);
  }

  onAbortClick(): void {
    this.dialogRef.close();
  }

  public showPolicy() {
    this.snackBar.open(`Contact id, user id, contact user id and the subscribed flag is saved on our server. This informations are essential for the functionality of the application.`, 'OK', {});
  }
}
