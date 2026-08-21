import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { ConnectFourCell } from '../../../interfaces/chat-game';
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
  readonly statusText = input('');
  readonly showStatus = input(true);
  readonly move = output<number>();
  readonly cells = computed(() => normalizeConnectFourBoard(this.board()));
  readonly winningCellIndexes = computed(() => new Set(getConnectFourWinningCellIndexes(this.cells())));
  readonly columns = Array.from({ length: CONNECT_FOUR_COLUMNS }, (_, index) => index);
  readonly hoveredColumn = signal<number | null>(null);
  readonly hoveredDropIndex = computed(() => {
    const column = this.hoveredColumn();
    return column === null ? null : getConnectFourDropIndex(this.cells(), column);
  });

  selectColumn(column: number): void {
    if (this.disabled() || getConnectFourDropIndex(this.cells(), column) === null) return;
    this.feedback.notifySelection();
    this.move.emit(column);
  }

  previewColumn(column: number, event: PointerEvent): void {
    if (this.disabled() || getConnectFourDropIndex(this.cells(), column) === null) return;
    this.hoveredColumn.set(column);
    if (event.pointerType === 'mouse') this.feedback.notifyHover();
  }

  clearPreview(column: number): void {
    if (this.hoveredColumn() === column) this.hoveredColumn.set(null);
  }

  isColumnFull(column: number): boolean {
    return getConnectFourDropIndex(this.cells(), column) === null;
  }

  getColumnAriaLabel(column: number): string {
    return this.translation.t('common.contact.chatroom.games.connectFourColumnAria', { column: column + 1 });
  }

  getCellMark(cell: ConnectFourCell): string {
    return cell === 'R' ? 'X' : cell === 'Y' ? 'O' : '';
  }
}
