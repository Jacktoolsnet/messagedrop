import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from "@angular/material/icon";
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-deleteplace',
  imports: [MatButtonModule, MatDialogActions, MatDialogClose, MatDialogTitle, MatDialogContent, TranslocoPipe, MatIcon],
  templateUrl: './delete-place.component.html',
  styleUrl: './delete-place.component.css'
})
export class DeletePlaceComponent {
  readonly dialogRef = inject(MatDialogRef<DeletePlaceComponent>);
}
