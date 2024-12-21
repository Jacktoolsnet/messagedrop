import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogTitle, MatDialogContent, MatDialogRef } from '@angular/material/dialog';

@Component({
    selector: 'app-deletemessage',
    imports: [MatButtonModule, MatDialogActions, MatDialogClose, MatDialogTitle, MatDialogContent],
    templateUrl: './delete-message.component.html',
    styleUrl: './delete-message.component.css'
})
export class DeleteMessageComponent {
  constructor(public dialogRef: MatDialogRef<DeleteMessageComponent>) {}
}
