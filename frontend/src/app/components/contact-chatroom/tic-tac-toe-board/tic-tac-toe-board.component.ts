import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TicTacToeCell } from '../../../interfaces/chat-game';
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

  readonly board = input<readonly TicTacToeCell[]>([]);
  readonly disabled = input(false);
  readonly statusText = input('');
  readonly move = output<number>();
  readonly cells = computed(() => normalizeTicTacToeBoard(this.board()));

  selectCell(index: number): void {
    if (this.disabled() || this.cells()[index] !== null) {
      return;
    }
    this.move.emit(index);
  }

  getCellAriaLabel(index: number, cell: TicTacToeCell): string {
    return cell
      ? this.translation.t('common.contact.chatroom.games.cellOccupiedAria', { cell: index + 1, mark: cell })
      : this.translation.t('common.contact.chatroom.games.cellEmptyAria', { cell: index + 1 });
  }
}
