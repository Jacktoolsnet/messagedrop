import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';

@Component({
  selector: 'app-reset-user',
  imports: [MatButtonModule, MatDialogActions, MatDialogClose, MatDialogTitle, MatDialogContent],
  templateUrl: './reset-user.component.html',
  styleUrl: './reset-user.component.css'
})
export class ResetUserComponent {
  constructor(public dialogRef: MatDialogRef<ResetUserComponent>) { }
}
