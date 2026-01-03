import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from "@angular/material/icon";
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-pin-hint',
  imports: [MatButtonModule, MatDialogActions, MatDialogClose, MatDialogTitle, MatDialogContent, TranslocoPipe, MatIcon],
  templateUrl: './pin-hint.component.html',
  styleUrl: './pin-hint.component.css'
})
export class PinHintComponent {
  readonly dialogRef = inject(MatDialogRef<PinHintComponent>);
}
