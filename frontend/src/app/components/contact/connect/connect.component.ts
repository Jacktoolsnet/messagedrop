import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogContainer, MatDialogActions, MatDialogClose, MatDialogTitle, MatDialogContent, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Mode } from '../../../interfaces/mode';
import { StyleService } from '../../../services/style.service';
import { PlaceComponent } from '../../place/place.component';
import { Contact } from '../../../interfaces/contact';
import { Connect } from '../../../interfaces/connect';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-contact',
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
    MatInputModule
  ],
  templateUrl: './connect.component.html',
  styleUrl: './connect.component.css'
})
export class ConnectComponent implements OnInit {
  private snackBarRef: any;
  public connectId: String = '';

  constructor(
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<PlaceComponent>,
    private style: StyleService,
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
    this.snackBarRef = this.snackBar.open(`Contact id, user id, contact user id and the subscribed flag is saved on our server. This informations are essential for the functionality of the application.`, 'OK', {});
  }
}
