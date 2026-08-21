import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { RockPaperScissorsChoice } from '../../../interfaces/chat-game';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';
import { RockPaperScissorsBoardComponent } from '../rock-paper-scissors-board/rock-paper-scissors-board.component';

@Component({
  selector: 'app-new-rock-paper-scissors-dialog',
  standalone: true,
  imports: [DialogHeaderComponent, RockPaperScissorsBoardComponent, MatDialogContent, MatDialogActions, MatButtonModule, MatIconModule, TranslocoPipe],
  templateUrl: './new-rock-paper-scissors-dialog.component.html',
  styleUrl: './new-rock-paper-scissors-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewRockPaperScissorsDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<NewRockPaperScissorsDialogComponent, RockPaperScissorsChoice>);
  readonly selectedChoice = signal<RockPaperScissorsChoice | null>(null);

  selectChoice(choice: RockPaperScissorsChoice): void {
    this.selectedChoice.set(choice);
  }

  send(): void {
    const choice = this.selectedChoice();
    if (choice) this.dialogRef.close(choice);
  }

  close(): void {
    this.dialogRef.close();
  }
}
