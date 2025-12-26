import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-delete-all-system-notification',
  standalone: true,
  imports: [MatButtonModule, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, TranslocoPipe],
  templateUrl: './delete-all-system-notification.component.html',
  styleUrl: './delete-all-system-notification.component.css'
})
export class DeleteAllSystemNotificationComponent {
  readonly dialogRef = inject(MatDialogRef<DeleteAllSystemNotificationComponent>);
}
