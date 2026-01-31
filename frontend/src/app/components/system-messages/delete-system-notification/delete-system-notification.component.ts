import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';

@Component({
  selector: 'app-delete-system-notification',
  standalone: true,
  imports: [
    DialogHeaderComponent,MatButtonModule, MatDialogContent, MatDialogActions, MatDialogClose, MatIcon, TranslocoPipe],
  templateUrl: './delete-system-notification.component.html',
  styleUrl: './delete-system-notification.component.css'
})
export class DeleteSystemNotificationComponent {
  readonly dialogRef = inject(MatDialogRef<DeleteSystemNotificationComponent>);
}
