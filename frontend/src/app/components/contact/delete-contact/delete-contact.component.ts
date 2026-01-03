import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from "@angular/material/icon";
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-deletecontact',
  imports: [MatButtonModule, MatDialogActions, MatDialogClose, MatDialogTitle, MatDialogContent, TranslocoPipe, MatIcon],
  templateUrl: './delete-contact.component.html',
  styleUrl: './delete-contact.component.css'
})
export class DeleteContactComponent {
  readonly dialogRef = inject(MatDialogRef<DeleteContactComponent>);
}
