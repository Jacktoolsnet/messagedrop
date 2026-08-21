import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { CodeGame, CodeSymbol } from '../../../interfaces/chat-game';
import { CODE_LENGTH, CODE_MAX_GUESSES, CODE_SYMBOLS, createCodeCommitment } from '../../../utils/code-game';

@Component({
  selector: 'app-code-board',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, TranslocoPipe],
  templateUrl: './code-board.component.html',
  styleUrl: './code-board.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CodeBoardComponent {
  readonly game = input<CodeGame | null>(null);
  readonly currentUserId = input('');
  readonly selectionMode = input(false);
  readonly disabled = input(false);
  readonly initialSelection = input<CodeSymbol[]>([]);
  readonly guess = output<CodeSymbol[]>();
  readonly evaluate = output<void>();
  readonly selectionChange = output<CodeSymbol[]>();
  readonly symbols = CODE_SYMBOLS;
  readonly maxGuesses = CODE_MAX_GUESSES;
  readonly selection = signal<CodeSymbol[]>([]);
  readonly commitmentVerified = signal<boolean | null>(null);
  readonly canSubmit = computed(() => this.selection().length === CODE_LENGTH && !this.disabled());

  constructor() {
    effect(() => {
      const game = this.game();
      if (!game?.revealedCode || !game.revealNonce) {
        this.commitmentVerified.set(null);
        return;
      }
      const expectedCommitment = game.commitment;
      void createCodeCommitment({ code: game.revealedCode, nonce: game.revealNonce })
        .then(commitment => this.commitmentVerified.set(commitment === expectedCommitment))
        .catch(() => this.commitmentVerified.set(false));
    });
  }

  add(symbol: CodeSymbol): void {
    if (this.disabled() || this.selection().length >= CODE_LENGTH) return;
    this.updateSelection([...this.selection(), symbol]);
  }

  remove(index: number): void {
    if (this.disabled()) return;
    this.updateSelection(this.selection().filter((_, current) => current !== index));
  }

  clear(): void { this.updateSelection([]); }

  submit(): void {
    if (!this.canSubmit()) return;
    this.guess.emit([...this.selection()]);
    if (!this.selectionMode()) this.updateSelection([]);
  }

  icon(symbol: CodeSymbol): string {
    return symbol === 'heart' ? 'favorite'
      : symbol === 'circle' ? 'circle'
        : symbol === 'square' ? 'square'
          : symbol === 'triangle' ? 'change_history'
            : symbol;
  }

  private updateSelection(value: CodeSymbol[]): void {
    this.selection.set(value);
    this.selectionChange.emit(value);
  }
}
