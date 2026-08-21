import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { CodeSymbol } from '../../../interfaces/chat-game';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';
import { CodeBoardComponent } from '../code-board/code-board.component';

@Component({ selector:'app-new-code-dialog', standalone:true,
  imports:[DialogHeaderComponent,CodeBoardComponent,MatDialogContent,MatDialogActions,MatButtonModule,MatIconModule,TranslocoPipe],
  templateUrl:'./new-code-dialog.component.html', styleUrl:'./new-code-dialog.component.css', changeDetection:ChangeDetectionStrategy.OnPush })
export class NewCodeDialogComponent {
  private readonly dialogRef=inject(MatDialogRef<NewCodeDialogComponent,CodeSymbol[]>);
  readonly code=signal<CodeSymbol[]>([]);
  send():void { if(this.code().length===4) this.dialogRef.close([...this.code()]); }
  close():void { this.dialogRef.close(); }
}
