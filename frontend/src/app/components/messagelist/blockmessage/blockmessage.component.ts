import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';

@Component({
  selector: 'app-blockmessage',
  standalone: true,
  imports: [MatButtonModule, MatDialogActions, MatDialogClose, MatDialogTitle, MatDialogContent],
  templateUrl: './blockmessage.component.html',
  styleUrl: './blockmessage.component.css'
})
export class BlockmessageComponent {
  constructor(public dialogRef: MatDialogRef<BlockmessageComponent>) {}
}
