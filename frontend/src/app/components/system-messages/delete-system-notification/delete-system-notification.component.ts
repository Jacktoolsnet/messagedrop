import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';

@Component({
  selector: 'app-delete-system-notification',
  standalone: true,
  imports: [MatButtonModule, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose],
  templateUrl: './delete-system-notification.component.html',
  styleUrl: './delete-system-notification.component.css'
})
export class DeleteSystemNotificationComponent {
  readonly dialogRef = inject(MatDialogRef<DeleteSystemNotificationComponent>);
}
