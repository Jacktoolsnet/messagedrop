import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-blockmessage',
  imports: [MatButtonModule, MatDialogActions, MatDialogClose, MatDialogTitle, MatDialogContent, TranslocoPipe],
  templateUrl: './block-message.component.html',
  styleUrl: './block-message.component.css'
})
export class BlockMessageComponent {
  readonly dialogRef = inject(MatDialogRef<BlockMessageComponent>);
}
