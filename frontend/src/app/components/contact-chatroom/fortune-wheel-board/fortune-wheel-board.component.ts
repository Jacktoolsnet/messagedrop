import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { FortuneWheelGame } from '../../../interfaces/chat-game';
import { GameFeedbackService } from '../../../services/game-feedback.service';

const WHEEL_COLORS = ['#21b6e8', '#8b6cff', '#f455a8', '#ff7355', '#ffb52e', '#43cf78',
  '#18b7a0', '#477ff2', '#bf5ee8', '#f06479', '#e69d26', '#69bb45'];

@Component({
  selector: 'app-fortune-wheel-board',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, TranslocoPipe],
  templateUrl: './fortune-wheel-board.component.html',
  styleUrl: './fortune-wheel-board.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FortuneWheelBoardComponent {
  readonly game = input<FortuneWheelGame | null>(null);
  readonly currentUserId = input('');
  readonly disabled = input(false);
  readonly spin = output<void>();
  readonly animating = signal(false);
  readonly rotation = signal(0);
  readonly winnerIndex = computed(() => this.animating() ? null : this.game()?.resultIndex ?? null);
  readonly winnerGradient = computed(() => {
    const game = this.game();
    const index = this.winnerIndex();
    if (!game || index === null) return 'none';
    const angle = 360 / game.entries.length;
    return `conic-gradient(from ${index * angle}deg, rgba(191,241,255,.72) 0deg ${angle}deg, transparent ${angle}deg 360deg)`;
  });
  readonly wheelGradient = computed(() => {
    const count = this.game()?.entries.length ?? 0;
    if (!count) return 'none';
    const angle = 360 / count;
    return `conic-gradient(${Array.from({ length: count }, (_, index) => {
      const start = index * angle;
      const end = (index + 1) * angle;
      return `${WHEEL_COLORS[index]} ${start}deg ${end}deg`;
    }).join(',')})`;
  });
  private readonly feedback = inject(GameFeedbackService);

  constructor() {
    effect(onCleanup => {
      const game = this.game();
      if (!game || game.resultIndex === null || game.resultIndex >= game.entries.length) return;
      const finalAngle = this.finalAngle(game.resultIndex, game.entries.length);
      const key = `fortune-wheel-animation:${this.currentUserId()}:${game.gameId}:${game.moveNumber}`;
      if (this.wasSeen(key)) {
        this.rotation.set(finalAngle);
        this.animating.set(false);
        return;
      }
      const current = untracked(() => this.rotation());
      const currentNormalized = ((current % 360) + 360) % 360;
      const delta = ((finalAngle - currentNormalized) + 360) % 360;
      const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.animating.set(true);
      const startTimer = setTimeout(() => this.rotation.set(current + 5 * 360 + delta), 30);
      const finishTimer = setTimeout(() => {
        this.animating.set(false);
        this.markSeen(key);
        this.feedback.notifyCorrect();
      }, reducedMotion ? 330 : 3550);
      onCleanup(() => { clearTimeout(startTimer); clearTimeout(finishTimer); });
    });
  }

  segmentCenter(index: number, count: number): number { return (index + .5) * (360 / count); }
  requestSpin(): void { if (!this.disabled() && !this.animating()) { this.feedback.notifySelection(); this.spin.emit(); } }
  private finalAngle(index: number, count: number): number {
    return ((360 - this.segmentCenter(index, count)) % 360 + 360) % 360;
  }
  private wasSeen(key: string): boolean { try { return sessionStorage.getItem(key) === '1'; } catch { return false; } }
  private markSeen(key: string): void { try { sessionStorage.setItem(key, '1'); } catch { /* storage can be unavailable */ } }
}
