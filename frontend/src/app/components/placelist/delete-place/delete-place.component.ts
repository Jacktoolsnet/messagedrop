import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogTitle, MatDialogContent, MatDialogRef } from '@angular/material/dialog';

@Component({
    selector: 'app-deleteplace',
    imports: [MatButtonModule, MatDialogActions, MatDialogClose, MatDialogTitle, MatDialogContent],
    templateUrl: './delete-place.component.html',
    styleUrl: './delete-place.component.css'
})
export class DeletePlaceComponent {
  constructor(public dialogRef: MatDialogRef<DeletePlaceComponent>) {}
}
