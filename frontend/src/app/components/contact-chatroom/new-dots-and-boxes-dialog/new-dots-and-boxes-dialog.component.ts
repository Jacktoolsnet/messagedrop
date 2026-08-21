import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { DotsAndBoxesGame, DotsAndBoxesMove } from '../../../interfaces/chat-game';
import { createDotsAndBoxesGame, createEmptyDotsAndBoxesGame } from '../../../utils/dots-and-boxes';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';
import { DotsAndBoxesBoardComponent } from '../dots-and-boxes-board/dots-and-boxes-board.component';

@Component({
  selector: 'app-new-dots-and-boxes-dialog',
  standalone: true,
  imports: [DialogHeaderComponent, DotsAndBoxesBoardComponent, MatDialogContent, MatDialogActions, MatButtonModule, MatIconModule, TranslocoPipe],
  templateUrl: './new-dots-and-boxes-dialog.component.html',
  styleUrl: './new-dots-and-boxes-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewDotsAndBoxesDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<NewDotsAndBoxesDialogComponent, DotsAndBoxesMove>);
  readonly game = signal<DotsAndBoxesGame>(createEmptyDotsAndBoxesGame('sender', 'recipient'));
  readonly selectedMove = signal<DotsAndBoxesMove | null>(null);

  selectMove(move: DotsAndBoxesMove): void {
    this.selectedMove.set(move);
    this.game.set(createDotsAndBoxesGame('sender', 'recipient', move));
  }

  send(): void {
    const move = this.selectedMove();
    if (move) this.dialogRef.close(move);
  }

  close(): void {
    this.dialogRef.close();
  }
}
