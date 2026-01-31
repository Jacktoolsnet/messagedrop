import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from "@angular/material/icon";
import { TranslocoPipe } from '@jsverse/transloco';
import { HelpDialogService } from '../../utils/help-dialog/help-dialog.service';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';

@Component({
  selector: 'app-pin-hint',
  imports: [
    DialogHeaderComponent,MatButtonModule, MatDialogActions, MatDialogClose, MatDialogContent, TranslocoPipe, MatIcon],
  templateUrl: './pin-hint.component.html',
  styleUrl: './pin-hint.component.css'
})
export class PinHintComponent {
  readonly dialogRef = inject(MatDialogRef<PinHintComponent>);
  readonly help = inject(HelpDialogService);
}
