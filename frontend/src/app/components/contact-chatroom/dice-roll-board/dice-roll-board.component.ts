import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { DiceRollGame } from '../../../interfaces/chat-game';
import { GameFeedbackService } from '../../../services/game-feedback.service';

@Component({
  selector: 'app-dice-roll-board',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, TranslocoPipe],
  templateUrl: './dice-roll-board.component.html',
  styleUrl: './dice-roll-board.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DiceRollBoardComponent {
  readonly game = input<DiceRollGame | null>(null);
  readonly currentUserId = input('');
  readonly disabled = input(false);
  readonly roll = output<void>();
  readonly animating = signal(false);
  readonly displayDice = computed(() => {
    const game = this.game();
    return game?.lastRoll.length ? game.lastRoll : Array.from({ length: game?.diceCount ?? 0 }, () => 0);
  });
  readonly total = computed(() => this.game()?.lastRoll.reduce((sum, value) => sum + value, 0) ?? 0);
  private animationTimer?: ReturnType<typeof setTimeout>;
  private readonly feedback = inject(GameFeedbackService);

  constructor() {
    effect(onCleanup => {
      const game = this.game();
      if (!game || game.moveNumber === 0) return;
      const key = `dice-roll-animation:${this.currentUserId()}:${game.gameId}:${game.moveNumber}`;
      if (this.wasSeen(key)) return;
      clearTimeout(this.animationTimer);
      this.animating.set(true);
      this.animationTimer = setTimeout(() => {
        this.animating.set(false);
        this.markSeen(key);
        this.feedback.notifyCorrect();
      }, 900);
      onCleanup(() => clearTimeout(this.animationTimer));
    });
  }

  glyph(value: number): string { return value ? ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][value - 1] : '?'; }
  requestRoll(): void { if (!this.disabled()) { this.feedback.notifySelection(); this.roll.emit(); } }
  private wasSeen(key: string): boolean { try { return sessionStorage.getItem(key) === '1'; } catch { return false; } }
  private markSeen(key: string): void { try { sessionStorage.setItem(key, '1'); } catch { /* storage can be unavailable */ } }
}
