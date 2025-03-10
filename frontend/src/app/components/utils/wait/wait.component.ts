import { Component } from '@angular/core';
import { MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ProfileComponent } from '../../user/profile/profile.component';

@Component({
  selector: 'app-wait',
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatProgressSpinnerModule
  ],
  templateUrl: './wait.component.html',
  styleUrl: './wait.component.css'
})
export class WaitComponent {

  constructor(
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<ProfileComponent>) { }

}
