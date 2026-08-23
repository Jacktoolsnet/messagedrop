import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { AsteroidDirection, AsteroidDuelAction, AsteroidDuelGame, TicTacToeMark } from '../../../interfaces/chat-game';
import { GameFeedbackService } from '../../../services/game-feedback.service';
import { legalMoveDestinations } from '../../../utils/asteroid-duel-game';

@Component({
  selector:'app-asteroid-duel-board',standalone:true,imports:[MatIconModule,TranslocoPipe],
  templateUrl:'./asteroid-duel-board.component.html',styleUrl:'./asteroid-duel-board.component.css',
  changeDetection:ChangeDetectionStrategy.OnPush
})
export class AsteroidDuelBoardComponent{
  readonly feedback=inject(GameFeedbackService);
  readonly game=input<AsteroidDuelGame|null>(null);
  readonly currentUserId=input('');
  readonly disabled=input(false);
  readonly action=output<AsteroidDuelAction>();
  readonly cells=Array.from({length:49},(_,index)=>index);
  readonly currentMark=computed<TicTacToeMark|null>(()=>{const game=this.game(),user=this.currentUserId();return !game?null:user===game.playerXUserId?'X':user===game.playerOUserId?'O':null});
  readonly displayedCells=computed(()=>this.currentMark()==='O'?[...this.cells].reverse():this.cells);
  readonly destinations=computed(()=>{const game=this.game();return new Set(game?legalMoveDestinations(game,this.currentUserId()):[])});
  readonly canAct=computed(()=>{const game=this.game();return !!game&&!this.disabled()&&game.status==='active'&&game.nextPlayerUserId===this.currentUserId()});

  shipAt(index:number):TicTacToeMark|null{const game=this.game();return !game?null:index===game.playerXPosition?'X':index===game.playerOPosition?'O':null}
  isLaserPath(index:number):boolean{return this.game()?.lastMove?.action.type==='fire'&&(this.game()?.lastMove?.path.includes(index)??false)}
  isLastPosition(index:number):boolean{const move=this.game()?.lastMove;return !!move&&(index===move.from||index===move.to)}
  move(index:number):void{if(!this.canAct()||!this.destinations().has(index))return;this.feedback.notifySelection();this.action.emit({type:'move',to:index})}
  fire(displayDirection:AsteroidDirection):void{if(!this.canAct())return;this.feedback.notifySelection();this.action.emit({type:'fire',direction:this.toBoardDirection(displayDirection)})}
  private toBoardDirection(direction:AsteroidDirection):AsteroidDirection{
    if(this.currentMark()!=='O')return direction;
    return({up:'down',right:'left',down:'up',left:'right'} as const)[direction];
  }
}
