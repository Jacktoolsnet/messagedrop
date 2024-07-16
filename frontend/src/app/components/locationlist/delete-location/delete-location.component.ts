import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogTitle, MatDialogContent, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-deletenote',
  standalone: true,
  imports: [MatButtonModule, MatDialogActions, MatDialogClose, MatDialogTitle, MatDialogContent],
  templateUrl: './delete-location.component.html',
  styleUrl: './delete-location.component.css'
})
export class DeleteLocationComponent {
  constructor(public dialogRef: MatDialogRef<DeleteLocationComponent>) {}
}
