import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';
import { ConnectFourVariant, TicTacToeVariant } from '../../../interfaces/chat-game';

export interface GameRulesDialogData {
  gameType: 'ticTacToe' | 'connectFour' | 'dotsAndBoxes' | 'rockPaperScissors' | 'code' | 'memory' | 'minefield' | 'minefieldHideSeek'|'morris'|'checkers'|'asteroidDuel'|'treasureMap'|'wordRescue'|'coinToss'|'diceRoll'|'fortuneWheel';
  variant?: TicTacToeVariant | ConnectFourVariant;
}

@Component({
  selector: 'app-game-rules-dialog',
  standalone: true,
  imports: [DialogHeaderComponent, MatDialogContent, MatDialogActions, MatButtonModule, MatIconModule, TranslocoPipe],
  templateUrl: './game-rules-dialog.component.html',
  styleUrl: './game-rules-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GameRulesDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<GameRulesDialogComponent>);
  readonly data = inject<GameRulesDialogData>(MAT_DIALOG_DATA);

  close(): void {
    this.dialogRef.close();
  }
}
