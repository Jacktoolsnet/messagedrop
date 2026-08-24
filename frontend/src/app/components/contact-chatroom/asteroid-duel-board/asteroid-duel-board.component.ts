import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
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
  private readonly visibleLaserMoveNumber=signal<number|null>(null);
  private readonly laserVisibilityEffect=effect(onCleanup=>{
    const move=this.game()?.lastMove;
    if(!move||move.action.type!=='fire'){this.visibleLaserMoveNumber.set(null);return}
    this.visibleLaserMoveNumber.set(move.moveNumber);
    const timer=setTimeout(()=>this.visibleLaserMoveNumber.set(null),2400);
    onCleanup(()=>clearTimeout(timer));
  });

  shipAt(index:number):TicTacToeMark|null{const game=this.game();return !game?null:index===game.playerXPosition?'X':index===game.playerOPosition?'O':null}
  isLaserPath(index:number):boolean{const move=this.game()?.lastMove;return !!move&&this.visibleLaserMoveNumber()===move.moveNumber&&move.action.type==='fire'&&move.path.includes(index)}
  isHorizontalLaser():boolean{const action=this.game()?.lastMove?.action;return action?.type==='fire'&&(action.direction==='left'||action.direction==='right')}
  isLaserImpact(index:number):boolean{const move=this.game()?.lastMove;if(!move||this.visibleLaserMoveNumber()!==move.moveNumber||move.action.type!=='fire'||(!move.hitPlayer&&move.destroyedAsteroid===null))return false;return move.path.at(-1)===index}
  shieldSlots(count:number):number[]{return Array.from({length:Math.max(0,count)},(_,index)=>index)}
  isLastPosition(index:number):boolean{const move=this.game()?.lastMove;return !!move&&(index===move.from||index===move.to)}
  move(index:number):void{if(!this.canAct()||!this.destinations().has(index))return;this.feedback.notifySelection();this.action.emit({type:'move',to:index})}
  fire(displayDirection:AsteroidDirection):void{if(!this.canAct())return;this.feedback.notifySelection();this.action.emit({type:'fire',direction:this.toBoardDirection(displayDirection)})}
  private toBoardDirection(direction:AsteroidDirection):AsteroidDirection{
    if(this.currentMark()!=='O')return direction;
    return({up:'down',right:'left',down:'up',left:'right'} as const)[direction];
  }
}
