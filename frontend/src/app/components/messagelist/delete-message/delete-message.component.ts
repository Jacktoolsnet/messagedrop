import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from "@angular/material/icon";
import { TranslocoPipe } from '@jsverse/transloco';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';

@Component({
  selector: 'app-deletemessage',
  imports: [
    DialogHeaderComponent,MatButtonModule, MatDialogActions, MatDialogClose, MatDialogContent, TranslocoPipe, MatIcon],
  templateUrl: './delete-message.component.html',
  styleUrl: './delete-message.component.css'
})
export class DeleteMessageComponent {
  readonly dialogRef = inject(MatDialogRef<DeleteMessageComponent>);
}
