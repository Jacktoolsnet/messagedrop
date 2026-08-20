import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TicTacToeCell, TicTacToeMark, TicTacToeVariant } from '../../../interfaces/chat-game';
import { GameFeedbackService } from '../../../services/game-feedback.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { normalizeTicTacToeBoard } from '../../../utils/tic-tac-toe';

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
  readonly statusText = input('');
  readonly showStatus = input(true);
  readonly move = output<number>();
  readonly cells = computed(() => normalizeTicTacToeBoard(this.board()));

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
