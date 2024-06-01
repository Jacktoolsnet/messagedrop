import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogTitle, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { BlockmessageComponent } from '../blockmessage/blockmessage.component';

@Component({
  selector: 'app-deletemessage',
  standalone: true,
  imports: [MatButtonModule, MatDialogActions, MatDialogClose, MatDialogTitle, MatDialogContent],
  templateUrl: './deletemessage.component.html',
  styleUrl: './deletemessage.component.css'
})
export class DeletemessageComponent {
  constructor(public dialogRef: MatDialogRef<BlockmessageComponent>) {}
}
