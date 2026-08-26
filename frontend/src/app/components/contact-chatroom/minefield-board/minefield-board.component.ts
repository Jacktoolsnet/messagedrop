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
  readonly deleted=input(false);
  readonly move=output<number>();
  readonly selectedCell=signal<number|null>(null);
  readonly detonatingMine=signal<number|null>(null);
  readonly explodingMines=signal<ReadonlySet<number>>(new Set());
  readonly cells=Array.from({length:MINEFIELD_CELL_COUNT},(_,index)=>index);

  selectCell(index:number):void{
    const game=this.game();
    if(this.disabled() || this.detonatingMine()!==null || game?.revealedBy[index])return;
    if(this.selectionMode()){
      this.feedback.notifySelection();
      this.selectedCell.set(index);
      this.move.emit(index);
      return;
    }
    if(!game || game.status!=='active' || game.nextPlayerUserId!==this.currentUserId())return;
    if(game.mines[index]){
      this.animateMineAndEmit(index);
      return;
    }
    this.feedback.notifySelection();
    this.move.emit(index);
  }

  isRevealed(index:number):boolean{
    const game=this.game();
    return this.selectedCell()===index || this.detonatingMine()===index || !!game?.revealedBy[index] || !!(game?.status!=='active' && game?.mines[index]);
  }
  isMine(index:number):boolean{return !!this.game()?.mines[index]}
  adjacentMines(index:number):number{return this.game()?countAdjacentMines(this.game()!.mines,index):0}
  owner(index:number):TicTacToeMark|null{return this.game()?.revealedBy[index]??null}
  isLastMove(index:number):boolean{return this.game()?.lastMove?.cellIndex===index}
  isExplosionAnimating(index:number):boolean{return this.explodingMines().has(index)}
  showsExplosion(index:number):boolean{
    return this.explodingMines().has(index) || (!!this.game()?.revealedBy[index] && this.isMine(index) && this.detonatingMine()!==index);
  }

  private async animateMineAndEmit(index:number):Promise<void>{
    this.detonatingMine.set(index);
    await this.feedback.notifyMineCountdown();
    if(this.deleted()||this.detonatingMine()!==index)return;
    this.detonatingMine.set(null);
    this.explodingMines.set(new Set([index]));
    this.feedback.notifyExplosion();
    this.move.emit(index);
    setTimeout(()=>this.explodingMines.set(new Set()),560);
  }
}
