import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';

@Component({
  selector: 'app-game-rules-dialog',
  standalone: true,
  imports: [DialogHeaderComponent, MatDialogContent, MatDialogActions, MatButtonModule, MatIconModule, TranslocoPipe],
  templateUrl: './game-rules-dialog.component.html',
  styleUrl: './game-rules-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GameRulesDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<GameRulesDialogComponent>);

  close(): void {
    this.dialogRef.close();
  }
}
