import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TicTacToeCell, TicTacToeMark, TicTacToeMove, TicTacToeVariant } from '../../../interfaces/chat-game';
import { GameFeedbackService } from '../../../services/game-feedback.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { getTicTacToeWinningCellIndexes, normalizeTicTacToeBoard } from '../../../utils/tic-tac-toe';

@Component({
  selector: 'app-tic-tac-toe-board',
  standalone: true,
  templateUrl: './tic-tac-toe-board.component.html',
  styleUrl: './tic-tac-toe-board.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TicTacToeBoardComponent {
  private readonly translation = inject(TranslationHelperService);
  private readonly feedback = inject(GameFeedbackService);

  readonly board = input<readonly TicTacToeCell[]>([]);
  readonly disabled = input(false);
  readonly playerMark = input<TicTacToeMark | null>(null);
  readonly variant = input<TicTacToeVariant>('standard');
  readonly moves = input<readonly TicTacToeMove[]>([]);
  readonly statusText = input('');
  readonly showStatus = input(true);
  readonly move = output<number>();
  readonly cells = computed(() => normalizeTicTacToeBoard(this.board()));
  readonly winningCellIndexes = computed(() => new Set(getTicTacToeWinningCellIndexes(this.cells())));
  readonly fadingCellIndexes = computed(() => {
    if (this.variant() !== 'vanishing') {
      return new Set<number>();
    }

    const cells = this.cells();
    const currentMoves = this.moves().filter(move =>
      Number.isInteger(move.cellIndex)
      && move.cellIndex >= 0
      && move.cellIndex < cells.length
      && cells[move.cellIndex] === move.mark
    );
    const fading = new Set<number>();
    for (const mark of ['X', 'O'] as const) {
      const ownMoves = currentMoves.filter(move => move.mark === mark);
      if (ownMoves.length >= 3) {
        fading.add(ownMoves[0].cellIndex);
      }
    }
    return fading;
  });

  selectCell(index: number): void {
    if (this.disabled() || this.cells()[index] !== null) {
      return;
    }
    this.feedback.notifySelection();
    this.move.emit(index);
  }

  previewCell(index: number, event: PointerEvent): void {
    if (event.pointerType !== 'mouse' || this.disabled() || this.cells()[index] !== null) {
      return;
    }
    this.feedback.notifyHover();
  }

  getCellAriaLabel(index: number, cell: TicTacToeCell): string {
    return cell
      ? this.translation.t('common.contact.chatroom.games.cellOccupiedAria', { cell: index + 1, mark: cell })
      : this.translation.t('common.contact.chatroom.games.cellEmptyAria', { cell: index + 1 });
  }

  getPlayerMarkText(mark: TicTacToeMark): string {
    return this.translation.t('common.contact.chatroom.games.yourMark', { mark });
  }

  getVariantText(): string {
    return this.translation.t('common.contact.chatroom.games.vanishingVariant');
  }
}
