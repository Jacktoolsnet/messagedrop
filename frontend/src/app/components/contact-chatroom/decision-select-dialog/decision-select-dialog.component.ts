import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';
import { GameRulesDialogComponent } from '../game-rules-dialog/game-rules-dialog.component';

export type DecisionHelperType = 'coinToss' | 'diceRoll' | 'fortuneWheel';

@Component({
  selector: 'app-decision-select-dialog',
  standalone: true,
  imports: [
    DialogHeaderComponent,
    MatButtonModule,
    MatDialogActions,
    MatDialogContent,
    MatIconModule,
    TranslocoPipe
  ],
  templateUrl: './decision-select-dialog.component.html',
  styleUrl: './decision-select-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DecisionSelectDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<DecisionSelectDialogComponent, DecisionHelperType>);
  private readonly dialog = inject(MatDialog);

  select(type: DecisionHelperType): void {
    this.dialogRef.close(type);
  }

  openHelp(type: DecisionHelperType): void {
    this.dialog.open(GameRulesDialogComponent, {
      data: { gameType: type, variant: 'standard' },
      width: 'min(440px, 94vw)',
      maxWidth: '94vw',
      maxHeight: '85vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}
