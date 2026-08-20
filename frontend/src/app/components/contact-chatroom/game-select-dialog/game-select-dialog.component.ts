import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { TicTacToeStats } from '../../../interfaces/chat-game';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';

export type ChatGameType = 'ticTacToe';

interface GameSelectDialogData {
  ticTacToeStats: TicTacToeStats;
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

  select(type: ChatGameType): void {
    this.dialogRef.close(type);
  }

  close(): void {
    this.dialogRef.close();
  }
}
