import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { TicTacToeCell, TicTacToeVariant } from '../../../interfaces/chat-game';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';
import { TicTacToeBoardComponent } from '../tic-tac-toe-board/tic-tac-toe-board.component';

@Component({
  selector: 'app-new-tic-tac-toe-dialog',
  standalone: true,
  imports: [DialogHeaderComponent, TicTacToeBoardComponent, MatDialogContent, MatDialogActions, MatButtonModule, MatIconModule, TranslocoPipe],
  templateUrl: './new-tic-tac-toe-dialog.component.html',
  styleUrl: './new-tic-tac-toe-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewTicTacToeDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<NewTicTacToeDialogComponent, number>);
  readonly data = inject<{ variant: TicTacToeVariant }>(MAT_DIALOG_DATA);
  readonly board = signal<TicTacToeCell[]>(Array<TicTacToeCell>(9).fill(null));
  readonly selectedCell = signal<number | null>(null);

  selectCell(index: number): void {
    const board = Array<TicTacToeCell>(9).fill(null);
    board[index] = 'X';
    this.board.set(board);
    this.selectedCell.set(index);
  }

  send(): void {
    const selectedCell = this.selectedCell();
    if (selectedCell !== null) {
      this.dialogRef.close(selectedCell);
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}
