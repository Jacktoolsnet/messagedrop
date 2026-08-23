import{ChangeDetectionStrategy,Component,computed,inject,input,output,signal}from'@angular/core';import{CheckersGame,TicTacToeMark}from'../../../interfaces/chat-game';import{GameFeedbackService}from'../../../services/game-feedback.service';import{CheckersAction,legalMoves}from'../../../utils/checkers-game';
@Component({selector:'app-checkers-board',standalone:true,templateUrl:'./checkers-board.component.html',styleUrl:'./checkers-board.component.css',changeDetection:ChangeDetectionStrategy.OnPush})export class CheckersBoardComponent{
 readonly feedback=inject(GameFeedbackService);readonly game=input<CheckersGame|null>(null);readonly currentUserId=input('');readonly selectionMode=input(false);readonly disabled=input(false);readonly action=output<CheckersAction>();readonly selected=signal<number|null>(null);readonly lastMoveDismissed=signal(false);readonly cells=Array.from({length:64},(_,i)=>i);
 readonly displayedCells=computed(()=>this.currentMark()==='O'?[...this.cells].reverse():this.cells);
 private readonly openingMoves=new Map<number,number[]>([[40,[33]],[42,[33,35]],[44,[35,37]],[46,[37,39]]]);
 readonly moves=computed(()=>{const g=this.game(),m=this.currentMark();return g&&m?legalMoves(g,m):[]});readonly destinations=computed(()=>{const from=this.selected()??this.game()?.forcedPieceIndex;return new Set(from===null||from===undefined?[]:this.moves().filter(m=>m.from===from).map(m=>m.to))});
 currentMark():TicTacToeMark|null{const g=this.game(),u=this.currentUserId();return g?u===g.playerXUserId?'X':u===g.playerOUserId?'O':null:null}
 pieceAt(i:number){
  const piece=this.game()?.board[i];if(piece||!this.selectionMode())return piece??null;
  const row=Math.floor(i/8);if(!this.isDark(i)||row<5)return null;
  return{mark:'X' as TicTacToeMark,king:false};
 }
 isLastMoveCell(i:number):boolean{const move=this.game()?.lastMove;if(!move)return false;return(move.turnPath??[move.from,move.to]).includes(i)||(move.capturedPieces?.some(value=>value.index===i)??move.captured===i)}
 ghostAt(i:number){if(this.lastMoveDismissed())return null;return this.game()?.lastMove?.capturedPieces?.find(value=>value.index===i)?.piece??null}
 isUnavailableOwnPiece(i:number):boolean{
  const piece=this.pieceAt(i);if(!piece)return false;
  if(this.selectionMode())return piece.mark==='X'&&!this.isSelectable(i);
  const game=this.game(),mark=this.currentMark();return !!game&&game.status==='active'&&game.nextPlayerUserId===this.currentUserId()&&piece.mark===mark&&!this.isSelectable(i);
 }
 isDark(i:number){return(Math.floor(i/8)+i%8)%2===1}isSelectable(i:number){return this.selectionMode()?this.openingMoves.has(i):this.moves().some(m=>m.from===i)}isDestination(i:number){if(this.selectionMode()){const from=this.selected();return from!==null&&!!this.openingMoves.get(from)?.includes(i)}return this.destinations().has(i)}
 choose(i:number){if(this.disabled())return;if(this.selectionMode()){if(this.openingMoves.has(i)){this.feedback.notifySelection();this.selected.set(i);return}const from=this.selected();if(from!==null&&this.openingMoves.get(from)?.includes(i)){this.feedback.notifySelection();this.action.emit({from,to:i})}return}const g=this.game();if(!g||g.nextPlayerUserId!==this.currentUserId())return;if(this.isSelectable(i)){if(g.lastMove?.playerUserId!==this.currentUserId())this.lastMoveDismissed.set(true);this.feedback.notifySelection();this.selected.set(i);return}const from=this.selected()??g.forcedPieceIndex;if(from!==null&&this.isDestination(i)){this.feedback.notifySelection();this.action.emit({from,to:i});this.selected.set(null)}}
}
