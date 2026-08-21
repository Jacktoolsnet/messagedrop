import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { MemorySymbol } from '../../../interfaces/chat-game';
import { createMemoryDeck } from '../../../utils/memory-game';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';
import { MemoryBoardComponent } from '../memory-board/memory-board.component';

export interface NewMemoryDialogResult { cards: MemorySymbol[]; firstTurn: [number, number]; }

@Component({selector:'app-new-memory-dialog',standalone:true,
  imports:[DialogHeaderComponent,MemoryBoardComponent,MatDialogContent,MatDialogActions,MatButtonModule,MatIconModule,TranslocoPipe],
  templateUrl:'./new-memory-dialog.component.html',styleUrl:'./new-memory-dialog.component.css',changeDetection:ChangeDetectionStrategy.OnPush})
export class NewMemoryDialogComponent {
  private readonly dialogRef=inject(MatDialogRef<NewMemoryDialogComponent,NewMemoryDialogResult>);
  readonly cards=createMemoryDeck();
  readonly firstTurn=signal<[number,number]|null>(null);
  selectTurn(turn:[number,number]):void{this.firstTurn.set(turn)}
  send():void{const firstTurn=this.firstTurn();if(firstTurn)this.dialogRef.close({cards:[...this.cards],firstTurn})}
  close():void{this.dialogRef.close()}
}
