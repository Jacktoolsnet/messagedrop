import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';

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
    public dialogRef: MatDialogRef<WaitComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { title: string, message: string }) { }

}
