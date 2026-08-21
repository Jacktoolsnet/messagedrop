import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ConnectFourVariant, GameStats, TicTacToeStats, TicTacToeVariant } from '../../../interfaces/chat-game';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';
import { GameRulesDialogComponent } from '../game-rules-dialog/game-rules-dialog.component';

export type ChatGameType = 'ticTacToe' | 'ticTacToeVanishing' | 'connectFour' | 'connectFourVanishing' | 'dotsAndBoxes' | 'rockPaperScissors' | 'code' | 'memory' | 'minefield' | 'minefieldHideSeek';

interface GameSelectDialogData {
  ticTacToeStats: TicTacToeStats;
  vanishingTicTacToeStats: TicTacToeStats;
  connectFourStats: GameStats;
  vanishingConnectFourStats: GameStats;
  dotsAndBoxesStats: GameStats;
  rockPaperScissorsStats: GameStats;
  codeStats: GameStats;
  memoryStats: GameStats;
  minefieldStats: GameStats;
  minefieldHideSeekStats: GameStats;
}

@Component({
  selector: 'app-game-select-dialog',
  standalone: true,
  imports: [DialogHeaderComponent, MatDialogContent, MatDialogActions, MatButtonModule, MatIconModule, TranslocoPipe],
  templateUrl: './game-select-dialog.component.html',
  styleUrl: './game-select-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GameSelectDialogComponent {
  readonly data = inject<GameSelectDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<GameSelectDialogComponent, ChatGameType>);
  private readonly dialog = inject(MatDialog);

  select(type: ChatGameType): void {
    this.dialogRef.close(type);
  }

  close(): void {
    this.dialogRef.close();
  }

  openRules(variant: TicTacToeVariant): void {
    this.dialog.open(GameRulesDialogComponent, {
      data: { gameType: 'ticTacToe', variant },
      width: 'min(440px, 94vw)',
      maxWidth: '94vw',
      maxHeight: '85vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
  }

  openConnectFourRules(variant: ConnectFourVariant): void {
    this.dialog.open(GameRulesDialogComponent, {
      data: { gameType: 'connectFour', variant },
      width: 'min(440px, 94vw)',
      maxWidth: '94vw',
      maxHeight: '85vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
  }

  openDotsAndBoxesRules(): void {
    this.dialog.open(GameRulesDialogComponent, {
      data: { gameType: 'dotsAndBoxes', variant: 'standard' },
      width: 'min(440px, 94vw)',
      maxWidth: '94vw',
      maxHeight: '85vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
  }

  openRockPaperScissorsRules(): void {
    this.dialog.open(GameRulesDialogComponent, {
      data: { gameType: 'rockPaperScissors', variant: 'standard' },
      width: 'min(440px, 94vw)',
      maxWidth: '94vw',
      maxHeight: '85vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
  }

  openCodeRules(): void {
    this.dialog.open(GameRulesDialogComponent, {
      data: { gameType: 'code', variant: 'standard' }, width: 'min(440px, 94vw)', maxWidth: '94vw',
      maxHeight: '85vh', hasBackdrop: true, backdropClass: 'dialog-backdrop', disableClose: false, autoFocus: false
    });
  }

  openMemoryRules(): void {
    this.dialog.open(GameRulesDialogComponent, {
      data: { gameType: 'memory', variant: 'standard' }, width: 'min(440px, 94vw)', maxWidth: '94vw',
      maxHeight: '85vh', hasBackdrop: true, backdropClass: 'dialog-backdrop', disableClose: false, autoFocus: false
    });
  }

  openMinefieldRules(): void {
    this.dialog.open(GameRulesDialogComponent, {
      data: { gameType: 'minefield', variant: 'standard' }, width: 'min(440px, 94vw)', maxWidth: '94vw',
      maxHeight: '85vh', hasBackdrop: true, backdropClass: 'dialog-backdrop', disableClose: false, autoFocus: false
    });
  }

  openMinefieldHideSeekRules(): void {
    this.dialog.open(GameRulesDialogComponent, {
      data: { gameType: 'minefieldHideSeek', variant: 'standard' }, width: 'min(440px, 94vw)', maxWidth: '94vw',
      maxHeight: '85vh', hasBackdrop: true, backdropClass: 'dialog-backdrop', disableClose: false, autoFocus: false
    });
  }
}
