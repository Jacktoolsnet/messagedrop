import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { MemoryGame, MemorySymbol, TicTacToeMark } from '../../../interfaces/chat-game';
import { GameFeedbackService } from '../../../services/game-feedback.service';
import { memoryScore } from '../../../utils/memory-game';

@Component({
  selector: 'app-memory-board', standalone: true, imports: [MatIconModule, TranslocoPipe],
  templateUrl: './memory-board.component.html', styleUrl: './memory-board.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemoryBoardComponent {
  private readonly feedback = inject(GameFeedbackService);
  readonly game = input<MemoryGame | null>(null);
  readonly deck = input<MemorySymbol[]>([]);
  readonly currentUserId = input('');
  readonly selectionMode = input(false);
  readonly disabled = input(false);
  readonly turn = output<[number, number]>();
  readonly selected = signal<number[]>([]);
  readonly lastMoveDismissed = signal(false);
  readonly resolving = signal(false);
  readonly cards = computed(() => this.game()?.cards ?? this.deck());

  selectCard(index: number): void {
    const game = this.game();
    if (this.disabled() || this.resolving() || !this.cards()[index] || game?.matchedBy[index]) return;
    if (game?.lastMove && !game.lastMove.matched && !this.lastMoveDismissed()) this.lastMoveDismissed.set(true);
    const current = this.selected();
    if (current.includes(index)) return;
    if (current.length >= 2) return;
    this.feedback.notifySelection();
    const next = [...current, index];
    this.selected.set(next);
    if (next.length === 2) {
      this.resolving.set(true);
      const pair: [number, number] = [next[0], next[1]];
      if (this.cards()[pair[0]] === this.cards()[pair[1]]) this.feedback.notifyCorrect();
      else this.feedback.notifyIncorrect();
      this.turn.emit(pair);
    }
  }

  isVisible(index: number): boolean {
    const game = this.game();
    return !!game?.matchedBy[index] || this.selected().includes(index)
      || !!(game?.lastMove && !game.lastMove.matched && !this.lastMoveDismissed() && game.lastMove.cardIndices.includes(index));
  }

  owner(index: number): TicTacToeMark | null { return this.game()?.matchedBy[index] ?? null; }
  score(mark: TicTacToeMark): number { return this.game() ? memoryScore(this.game()!, mark) : 0; }
}
