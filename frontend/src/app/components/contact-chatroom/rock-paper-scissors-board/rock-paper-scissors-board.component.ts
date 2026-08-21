import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { RockPaperScissorsChoice, RockPaperScissorsGame } from '../../../interfaces/chat-game';
import { GameFeedbackService } from '../../../services/game-feedback.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';

@Component({
  selector: 'app-rock-paper-scissors-board',
  standalone: true,
  imports: [TranslocoPipe],
  templateUrl: './rock-paper-scissors-board.component.html',
  styleUrl: './rock-paper-scissors-board.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RockPaperScissorsBoardComponent {
  private readonly feedback = inject(GameFeedbackService);
  private readonly translation = inject(TranslationHelperService);

  readonly game = input<RockPaperScissorsGame | null>(null);
  readonly currentUserId = input('');
  readonly selectionMode = input(false);
  readonly selectedChoice = input<RockPaperScissorsChoice | null>(null);
  readonly disabled = input(false);
  readonly statusText = input('');
  readonly showStatus = input(true);
  readonly choice = output<RockPaperScissorsChoice>();
  readonly choices: readonly RockPaperScissorsChoice[] = ['rock', 'paper', 'scissors'];

  canChoose(): boolean {
    if (this.disabled()) return false;
    if (this.selectionMode()) return true;
    const game = this.game();
    return !!game && game.status === 'active' && game.nextPlayerUserId === this.currentUserId();
  }

  selectChoice(choice: RockPaperScissorsChoice): void {
    if (!this.canChoose()) return;
    this.feedback.notifySelection();
    this.choice.emit(choice);
  }

  previewChoice(event: PointerEvent): void {
    if (event.pointerType !== 'mouse' || !this.canChoose()) return;
    this.feedback.notifyHover();
  }

  showFirstChoice(game: RockPaperScissorsGame): boolean {
    return game.status !== 'active' || game.playerXUserId === this.currentUserId();
  }

  getChoiceIcon(choice: RockPaperScissorsChoice): string {
    return choice === 'rock' ? '🪨' : choice === 'paper' ? '📄' : '✂️';
  }

  getChoiceLabel(choice: RockPaperScissorsChoice): string {
    return this.translation.t(`common.contact.chatroom.games.${choice}`);
  }
}
