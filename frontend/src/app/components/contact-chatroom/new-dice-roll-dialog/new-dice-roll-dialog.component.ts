import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { isValidDiceCount } from '../../../utils/dice-roll';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';

export interface NewDiceRollDialogResult { diceCount: number; }

@Component({
  selector: 'app-new-dice-roll-dialog',
  standalone: true,
  imports: [FormsModule, DialogHeaderComponent, MatButtonModule, MatDialogActions, MatDialogContent,
    MatFormFieldModule, MatIconModule, MatInputModule, TranslocoPipe],
  templateUrl: './new-dice-roll-dialog.component.html',
  styleUrl: './new-dice-roll-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewDiceRollDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<NewDiceRollDialogComponent, NewDiceRollDialogResult>);
  readonly diceCount = signal(2);

  updateDiceCount(value: string | number): void {
    this.diceCount.set(Number(value));
  }

  submit(): void {
    if (isValidDiceCount(this.diceCount())) this.dialogRef.close({ diceCount: this.diceCount() });
  }

  close(): void { this.dialogRef.close(); }
}
