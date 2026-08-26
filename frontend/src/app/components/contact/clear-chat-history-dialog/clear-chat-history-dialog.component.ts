import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';

@Component({
  selector: 'app-clear-chat-history-dialog',
  imports: [DialogHeaderComponent, MatButtonModule, MatDialogActions, MatDialogClose, MatDialogContent, MatIconModule, TranslocoPipe],
  templateUrl: './clear-chat-history-dialog.component.html',
  styleUrl: './clear-chat-history-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClearChatHistoryDialogComponent {}
