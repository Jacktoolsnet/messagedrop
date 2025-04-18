import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';

@Component({
  selector: 'app-pin-hint',
  imports: [MatButtonModule, MatDialogActions, MatDialogClose, MatDialogTitle, MatDialogContent],
  templateUrl: './pin-hint.component.html',
  styleUrl: './pin-hint.component.css'
})
export class PinHintComponent {
  constructor(public dialogRef: MatDialogRef<PinHintComponent>) { }
}
