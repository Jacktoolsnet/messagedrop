import{ChangeDetectionStrategy,Component,computed,inject,input,output,signal}from'@angular/core';
import{MorrisGame,TicTacToeMark}from'../../../interfaces/chat-game';
import{GameFeedbackService}from'../../../services/game-feedback.service';
import{MorrisAction,removablePositions,validDestinations}from'../../../utils/morris-game';

@Component({selector:'app-morris-board',standalone:true,templateUrl:'./morris-board.component.html',styleUrl:'./morris-board.component.css',changeDetection:ChangeDetectionStrategy.OnPush})
export class MorrisBoardComponent{
 readonly feedback=inject(GameFeedbackService);
 readonly game=input<MorrisGame|null>(null);readonly currentUserId=input('');readonly selectionMode=input(false);readonly disabled=input(false);
 readonly action=output<MorrisAction>();readonly firstPosition=output<number>();readonly selected=signal<number|null>(null);
 readonly traySlots=Array.from({length:9},(_,index)=>index);
 readonly points=[{x:9,y:9},{x:50,y:9},{x:91,y:9},{x:23,y:23},{x:50,y:23},{x:77,y:23},{x:36,y:36},{x:50,y:36},{x:64,y:36},{x:9,y:50},{x:23,y:50},{x:36,y:50},{x:64,y:50},{x:77,y:50},{x:91,y:50},{x:36,y:64},{x:50,y:64},{x:64,y:64},{x:23,y:77},{x:50,y:77},{x:77,y:77},{x:9,y:91},{x:50,y:91},{x:91,y:91}];
 readonly validTargets=computed(()=>{
  if(this.selectionMode())return new Set(this.points.map((_,index)=>index));const game=this.game();if(!game||game.status!=='active'||game.nextPlayerUserId!==this.currentUserId())return new Set<number>();
  if(game.phase==='placing')return new Set(game.board.flatMap((cell,index)=>cell?[]:[index]));
  if(game.phase==='removing')return new Set(removablePositions(game,this.currentMark()!));
  const selected=this.selected();return selected===null?new Set<number>():new Set(validDestinations(game,selected));
 });
 currentMark():TicTacToeMark|null{const g=this.game(),u=this.currentUserId();return g?u===g.playerXUserId?'X':u===g.playerOUserId?'O':null:null}
 isSelectableStone(index:number):boolean{const g=this.game(),mark=this.currentMark();return !!g&&g.phase==='moving'&&g.board[index]===mark&&validDestinations(g,index).length>0&&g.nextPlayerUserId===this.currentUserId()}
 choose(index:number):void{
  if(this.disabled())return;if(this.selectionMode()){this.feedback.notifySelection();this.firstPosition.emit(index);return}
  const g=this.game(),mark=this.currentMark();if(!g||!mark||g.status!=='active'||g.nextPlayerUserId!==this.currentUserId())return;
  if(g.phase==='placing'&&this.validTargets().has(index)){this.feedback.notifySelection();this.action.emit({type:'place',to:index});return}
  if(g.phase==='removing'&&this.validTargets().has(index)){this.feedback.notifyCorrect();this.action.emit({type:'remove',position:index});return}
  if(g.phase==='moving'){
   if(g.board[index]===mark&&this.isSelectableStone(index)){this.feedback.notifySelection();this.selected.set(index);return}
   const from=this.selected();if(from!==null&&this.validTargets().has(index)){this.feedback.notifySelection();this.action.emit({type:'move',from,to:index});this.selected.set(null)}
  }
 }
 owner(index:number):TicTacToeMark|null{return this.game()?.board[index]??null}
 isValid(index:number):boolean{return this.validTargets().has(index)}
 isReserveTray():boolean{const g=this.game();return !!g&&(g.inHandX>0||g.inHandO>0)}
 trayMark():TicTacToeMark{
  const own=this.currentMark()??'X';
  return this.isReserveTray()?own:own==='X'?'O':'X';
 }
 trayCount():number{
  const g=this.game(),mark=this.trayMark();if(!g)return 0;
  if(this.isReserveTray())return mark==='X'?g.inHandX:g.inHandO;
  return 9-g.board.filter(owner=>owner===mark).length;
 }
}
