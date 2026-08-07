import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { TripGoStop } from '../../interfaces/tripgo';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';

@Component({
  selector: 'app-tripgo-stop-dialog',
  imports: [
    DialogHeaderComponent,
    MatButtonModule,
    MatDialogActions,
    MatDialogContent,
    MatIconModule,
    TranslocoPipe
  ],
  templateUrl: './tripgo-stop-dialog.component.html',
  styleUrl: './tripgo-stop-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TripGoStopDialogComponent {
  readonly stop = inject<TripGoStop>(MAT_DIALOG_DATA);
  readonly help = inject(HelpDialogService);
  private readonly dialogRef = inject(MatDialogRef<TripGoStopDialogComponent>);

  close(): void {
    this.dialogRef.close();
  }
}
