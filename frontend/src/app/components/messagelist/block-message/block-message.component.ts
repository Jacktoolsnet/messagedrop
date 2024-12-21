import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';

@Component({
    selector: 'app-blockmessage',
    imports: [MatButtonModule, MatDialogActions, MatDialogClose, MatDialogTitle, MatDialogContent],
    templateUrl: './block-message.component.html',
    styleUrl: './block-message.component.css'
})
export class BlockMessageComponent {
  constructor(public dialogRef: MatDialogRef<BlockMessageComponent>) {}
}
