import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from "@angular/material/icon";
import { TranslocoPipe } from '@jsverse/transloco';

export interface ConfirmDialogData {
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

@Component({
  selector: 'app-deleteuser',
  imports: [MatButtonModule, MatDialogActions, MatDialogClose, MatDialogTitle, MatDialogContent, TranslocoPipe, MatIcon],
  templateUrl: './delete-user.component.html',
  styleUrl: './delete-user.component.css'
})
export class DeleteUserComponent {
  readonly dialogRef = inject(MatDialogRef<DeleteUserComponent>);
  readonly data = inject<ConfirmDialogData | null>(MAT_DIALOG_DATA, { optional: true });
}
