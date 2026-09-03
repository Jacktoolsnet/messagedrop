import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { ConnectFourCell, ConnectFourMove, ConnectFourVariant, TicTacToeMark } from '../../../interfaces/chat-game';
import { GameFeedbackService } from '../../../services/game-feedback.service';
import {
  CONNECT_FOUR_COLUMNS,
  getConnectFourDropIndex,
  getConnectFourWinningCellIndexes,
  normalizeConnectFourBoard
} from '../../../utils/connect-four';
import { TranslationHelperService } from '../../../services/translation-helper.service';

@Component({
  selector: 'app-connect-four-board',
  standalone: true,
  templateUrl: './connect-four-board.component.html',
  styleUrl: './connect-four-board.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConnectFourBoardComponent {
  private readonly feedback = inject(GameFeedbackService);
  private readonly translation = inject(TranslationHelperService);

  readonly board = input<readonly ConnectFourCell[]>([]);
  readonly disabled = input(false);
  readonly variant = input<ConnectFourVariant>('standard');
  readonly moves = input<readonly ConnectFourMove[]>([]);
  readonly playerMark = input<TicTacToeMark | null>(null);
  readonly statusText = input('');
  readonly showStatus = input(true);
  readonly move = output<number>();
  readonly cells = computed(() => normalizeConnectFourBoard(this.board()));
  readonly winningCellIndexes = computed(() => new Set(getConnectFourWinningCellIndexes(this.cells())));
  readonly lastMoveCellIndex = computed(() => {
    const cells = this.cells();
    const moves = this.moves();
    for (let index = moves.length - 1; index >= 0; index -= 1) {
      const move = moves[index];
      if (
        Number.isInteger(move.cellIndex)
        && move.cellIndex >= 0
        && move.cellIndex < cells.length
        && cells[move.cellIndex] === move.mark
      ) {
        return move.cellIndex;
      }
    }
    return null;
  });
  readonly fadingCellIndexes = computed(() => {
    if (this.variant() !== 'vanishing') return new Set<number>();
    const cells = this.cells();
    const currentMoves = this.moves().filter(move =>
      Number.isInteger(move.cellIndex)
      && move.cellIndex >= 0
      && move.cellIndex < cells.length
      && cells[move.cellIndex] === move.mark
    );
    const fading = new Set<number>();
    for (const mark of ['R', 'Y'] as const) {
      const ownMoves = currentMoves.filter(move => move.mark === mark);
      if (ownMoves.length >= 4) fading.add(ownMoves[0].cellIndex);
    }
    return fading;
  });
  readonly columns = Array.from({ length: CONNECT_FOUR_COLUMNS }, (_, index) => index);
  readonly hoveredColumn = signal<number | null>(null);
  readonly hoveredDropIndex = computed(() => {
    const column = this.hoveredColumn();
    return column === null ? null : getConnectFourDropIndex(this.cells(), column);
  });

  selectColumn(column: number): void {
    if (this.disabled() || !this.canPlayColumn(column)) return;
    this.feedback.notifySelection();
    this.move.emit(column);
  }

  previewColumn(column: number, event: PointerEvent): void {
    if (this.disabled() || !this.canPlayColumn(column)) return;
    this.hoveredColumn.set(column);
    if (event.pointerType === 'mouse') this.feedback.notifyHover();
  }

  clearPreview(column: number): void {
    if (this.hoveredColumn() === column) this.hoveredColumn.set(null);
  }

  isColumnFull(column: number): boolean {
    return !this.canPlayColumn(column);
  }

  getColumnAriaLabel(column: number): string {
    return this.translation.t('common.contact.chatroom.games.connectFourColumnAria', { column: column + 1 });
  }

  getCellMark(cell: ConnectFourCell): string {
    return cell === 'R' ? 'X' : cell === 'Y' ? 'O' : '';
  }

  private canPlayColumn(column: number): boolean {
    if (getConnectFourDropIndex(this.cells(), column) !== null) return true;
    const playerMark = this.playerMark() === 'X' ? 'R' : this.playerMark() === 'O' ? 'Y' : null;
    return this.variant() === 'vanishing'
      && playerMark !== null
      && [...this.fadingCellIndexes()].some(index =>
        index % CONNECT_FOUR_COLUMNS === column && this.cells()[index] === playerMark
      );
  }
}
