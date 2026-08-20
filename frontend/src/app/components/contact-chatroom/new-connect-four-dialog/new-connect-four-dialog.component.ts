import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ConnectFourCell } from '../../../interfaces/chat-game';
import { CONNECT_FOUR_CELL_COUNT, getConnectFourDropIndex } from '../../../utils/connect-four';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';
import { ConnectFourBoardComponent } from '../connect-four-board/connect-four-board.component';

@Component({
  selector: 'app-new-connect-four-dialog',
  standalone: true,
  imports: [DialogHeaderComponent, ConnectFourBoardComponent, MatDialogContent, MatDialogActions, MatButtonModule, MatIconModule, TranslocoPipe],
  templateUrl: './new-connect-four-dialog.component.html',
  styleUrl: './new-connect-four-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewConnectFourDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<NewConnectFourDialogComponent, number>);
  readonly board = signal<ConnectFourCell[]>(Array<ConnectFourCell>(CONNECT_FOUR_CELL_COUNT).fill(null));
  readonly selectedColumn = signal<number | null>(null);

  selectColumn(column: number): void {
    const board = Array<ConnectFourCell>(CONNECT_FOUR_CELL_COUNT).fill(null);
    const index = getConnectFourDropIndex(board, column);
    if (index === null) return;
    board[index] = 'R';
    this.board.set(board);
    this.selectedColumn.set(column);
  }

  send(): void {
    const column = this.selectedColumn();
    if (column !== null) this.dialogRef.close(column);
  }

  close(): void {
    this.dialogRef.close();
  }
}
