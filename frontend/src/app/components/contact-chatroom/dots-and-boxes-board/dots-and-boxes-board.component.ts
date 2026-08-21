import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { DotsAndBoxesGame, DotsAndBoxesMove } from '../../../interfaces/chat-game';
import { GameFeedbackService } from '../../../services/game-feedback.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { DOTS_AND_BOXES_DOTS_PER_SIDE } from '../../../utils/dots-and-boxes';

@Component({
  selector: 'app-dots-and-boxes-board',
  standalone: true,
  templateUrl: './dots-and-boxes-board.component.html',
  styleUrl: './dots-and-boxes-board.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DotsAndBoxesBoardComponent {
  private readonly feedback = inject(GameFeedbackService);
  private readonly translation = inject(TranslationHelperService);

  readonly game = input.required<DotsAndBoxesGame>();
  readonly disabled = input(false);
  readonly statusText = input('');
  readonly showStatus = input(true);
  readonly move = output<DotsAndBoxesMove>();
  readonly rows = Array.from({ length: DOTS_AND_BOXES_DOTS_PER_SIDE }, (_, index) => index);
  readonly columns = Array.from({ length: DOTS_AND_BOXES_DOTS_PER_SIDE }, (_, index) => index);
  readonly xScore = computed(() => this.game().boxes.filter(box => box === 'X').length);
  readonly oScore = computed(() => this.game().boxes.filter(box => box === 'O').length);

  horizontalEdgeIndex(row: number, column: number): number {
    return row * (DOTS_AND_BOXES_DOTS_PER_SIDE - 1) + column;
  }

  verticalEdgeIndex(row: number, column: number): number {
    return row * DOTS_AND_BOXES_DOTS_PER_SIDE + column;
  }

  boxIndex(row: number, column: number): number {
    return row * (DOTS_AND_BOXES_DOTS_PER_SIDE - 1) + column;
  }

  selectEdge(orientation: DotsAndBoxesMove['orientation'], index: number): void {
    if (this.disabled() || this.isEdgeSelected(orientation, index)) return;
    this.feedback.notifySelection();
    this.move.emit({ orientation, index });
  }

  previewEdge(orientation: DotsAndBoxesMove['orientation'], index: number, event: PointerEvent): void {
    if (event.pointerType !== 'mouse' || this.disabled() || this.isEdgeSelected(orientation, index)) return;
    this.feedback.notifyHover();
  }

  isEdgeSelected(orientation: DotsAndBoxesMove['orientation'], index: number): boolean {
    return orientation === 'horizontal'
      ? this.game().horizontalEdges[index] === true
      : this.game().verticalEdges[index] === true;
  }

  getEdgeAriaLabel(orientation: DotsAndBoxesMove['orientation'], index: number): string {
    return this.translation.t('common.contact.chatroom.games.dotsAndBoxesEdgeAria', {
      orientation: this.translation.t(orientation === 'horizontal'
        ? 'common.contact.chatroom.games.horizontalEdge'
        : 'common.contact.chatroom.games.verticalEdge'),
      edge: index + 1
    });
  }
}
