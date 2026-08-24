import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { TranslocoPipe } from '@jsverse/transloco';
import { isValidDiceCount } from '../../../utils/dice-roll';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';

export interface NewDiceRollDialogResult { diceCount: number; }
export interface NewDiceRollDialogData { diceCount?: number; settings?: boolean; }

@Component({
  selector: 'app-new-dice-roll-dialog',
  standalone: true,
  imports: [FormsModule, DialogHeaderComponent, MatButtonModule, MatDialogActions, MatDialogContent,
    MatIconModule, MatSliderModule, TranslocoPipe],
  templateUrl: './new-dice-roll-dialog.component.html',
  styleUrl: './new-dice-roll-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewDiceRollDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<NewDiceRollDialogComponent, NewDiceRollDialogResult>);
  private readonly data = inject<NewDiceRollDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  readonly settings = this.data?.settings === true;
  readonly diceCount = signal(this.data?.diceCount ?? 2);

  updateDiceCount(value: string | number): void {
    this.diceCount.set(Number(value));
  }

  submit(): void {
    if (isValidDiceCount(this.diceCount())) this.dialogRef.close({ diceCount: this.diceCount() });
  }

  close(): void { this.dialogRef.close(); }
}
