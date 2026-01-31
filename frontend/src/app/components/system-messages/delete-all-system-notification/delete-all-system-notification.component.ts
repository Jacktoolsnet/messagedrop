import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';

@Component({
  selector: 'app-delete-all-system-notification',
  standalone: true,
  imports: [
    DialogHeaderComponent,MatButtonModule, MatDialogContent, MatDialogActions, MatDialogClose, MatIcon, TranslocoPipe],
  templateUrl: './delete-all-system-notification.component.html',
  styleUrl: './delete-all-system-notification.component.css'
})
export class DeleteAllSystemNotificationComponent {
  readonly dialogRef = inject(MatDialogRef<DeleteAllSystemNotificationComponent>);
}
