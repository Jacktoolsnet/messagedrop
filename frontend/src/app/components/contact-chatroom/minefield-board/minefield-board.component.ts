import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { MinefieldGame, TicTacToeMark } from '../../../interfaces/chat-game';
import { GameFeedbackService } from '../../../services/game-feedback.service';
import { countAdjacentMines, MINEFIELD_CELL_COUNT } from '../../../utils/minefield-game';

@Component({selector:'app-minefield-board',standalone:true,imports:[MatIconModule,TranslocoPipe],
  templateUrl:'./minefield-board.component.html',styleUrl:'./minefield-board.component.css',changeDetection:ChangeDetectionStrategy.OnPush})
export class MinefieldBoardComponent {
  private readonly feedback=inject(GameFeedbackService);
  readonly game=input<MinefieldGame|null>(null);
  readonly currentUserId=input('');
  readonly selectionMode=input(false);
  readonly disabled=input(false);
  readonly move=output<number>();
  readonly selectedCell=signal<number|null>(null);
  readonly cells=Array.from({length:MINEFIELD_CELL_COUNT},(_,index)=>index);

  selectCell(index:number):void{
    const game=this.game();
    if(this.disabled() || game?.revealedBy[index])return;
    if(this.selectionMode()){
      this.feedback.notifySelection();
      this.selectedCell.set(index);
      this.move.emit(index);
      return;
    }
    if(!game || game.status!=='active' || game.nextPlayerUserId!==this.currentUserId())return;
    if(game.mines[index])this.feedback.notifyIncorrect();else this.feedback.notifySelection();
    this.move.emit(index);
  }

  isRevealed(index:number):boolean{
    const game=this.game();
    return this.selectedCell()===index || !!game?.revealedBy[index] || !!(game?.status!=='active' && game?.mines[index]);
  }
  isMine(index:number):boolean{return !!this.game()?.mines[index]}
  adjacentMines(index:number):number{return this.game()?countAdjacentMines(this.game()!.mines,index):0}
  owner(index:number):TicTacToeMark|null{return this.game()?.revealedBy[index]??null}
  isLastMove(index:number):boolean{return this.game()?.lastMove?.cellIndex===index}
}
