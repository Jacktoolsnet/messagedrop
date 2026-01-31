import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';

@Component({
  selector: 'app-reset-user',
  imports: [
    DialogHeaderComponent,MatButtonModule, MatDialogActions, MatDialogClose, MatDialogContent, TranslocoPipe],
  templateUrl: './reset-user.component.html',
  styleUrl: './reset-user.component.css'
})
export class ResetUserComponent {
  readonly dialogRef = inject(MatDialogRef<ResetUserComponent>);
}
