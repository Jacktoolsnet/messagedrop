import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { MinefieldHideSeekGame, MinefieldHideSeekRound } from '../../../interfaces/chat-game';
import { GameFeedbackService } from '../../../services/game-feedback.service';
import { areHideSeekCellsAdjacent, countHideSeekAdjacentMines, currentHideSeekRound, HIDE_SEEK_CELL_COUNT, HIDE_SEEK_MINE_COUNT } from '../../../utils/minefield-hide-seek';

@Component({selector:'app-minefield-hide-seek-board',standalone:true,imports:[MatButtonModule,MatIconModule,TranslocoPipe],
 templateUrl:'./minefield-hide-seek-board.component.html',styleUrl:'./minefield-hide-seek-board.component.css',changeDetection:ChangeDetectionStrategy.OnPush})
export class MinefieldHideSeekBoardComponent{
 private readonly feedback=inject(GameFeedbackService);
 readonly game=input<MinefieldHideSeekGame|null>(null);
 readonly currentUserId=input('');
 readonly placementMode=input(false);
 readonly disabled=input(false);
 readonly showHiddenMines=input(false);
 readonly search=output<number>();
 readonly placement=output<number[]>();
 readonly placementChange=output<number[]>();
 readonly selectedMines=signal<number[]>([]);
 readonly explodedMines=signal<ReadonlySet<number>>(new Set());
 readonly defusedMines=signal<ReadonlySet<number>>(new Set());
 readonly showingLostRound=signal(false);
 readonly showingWonRound=signal(false);
 readonly cells=Array.from({length:HIDE_SEEK_CELL_COUNT},(_,index)=>index);
 readonly mineCount=HIDE_SEEK_MINE_COUNT;
 private animatedLossKey='';
 private animatedWinKey='';

 constructor(){
  effect(()=>{
   const game=this.game(),round=this.round();
   if(!game||!round?.lost||(game.phase!=='placingSecond'&&game.phase!=='finished'))return;
   const key=`${game.gameId}:${game.rounds.indexOf(round)}:${round.lastMove?.moveNumber??0}`;
   if(this.animatedLossKey===key)return;
   this.animatedLossKey=key;
   this.animateLostRound(game,round);
  });
  effect(()=>{
   const game=this.game(),round=this.round();
   if(!game||!round||round.lost||(game.phase!=='placingSecond'&&game.phase!=='finished'))return;
   if(!round.mines.every((mine,index)=>mine||round.revealed[index]))return;
   const key=`${game.gameId}:${game.rounds.indexOf(round)}:${round.lastMove?.moveNumber??0}`;
   if(this.animatedWinKey===key)return;
   this.animatedWinKey=key;
   this.animateWonRound(game,round);
  });
 }

 round():MinefieldHideSeekRound|null{return this.game()?currentHideSeekRound(this.game()!):null}
 isPlacement():boolean{return this.placementMode()||this.game()?.phase==='placingSecond'}
 toggleMine(index:number):void{
  if(this.disabled()||!this.isPlacement()||this.isShowingRoundResult())return;
  const selected=this.selectedMines();
  if(selected.includes(index)){this.feedback.notifySelection();const next=selected.filter(value=>value!==index);this.selectedMines.set(next);this.placementChange.emit(next);return}
  if(selected.length>=HIDE_SEEK_MINE_COUNT||this.isBlockedForPlacement(index))return;
  this.feedback.notifySelection();const next=[...selected,index];this.selectedMines.set(next);this.placementChange.emit(next);
 }
 selectCell(index:number):void{
  if(this.isPlacement()){this.toggleMine(index);return}
  const game=this.game(),round=this.round();
  if(this.disabled()||!game||!round||round.revealed[index]||game.nextPlayerUserId!==this.currentUserId()||round.seekerUserId!==this.currentUserId())return;
  if(round.mines[index])this.feedback.notifyIncorrect();else this.feedback.notifySelection();
  this.search.emit(index);
 }
 submitPlacement():void{if(this.selectedMines().length===HIDE_SEEK_MINE_COUNT)this.placement.emit([...this.selectedMines()])}
 isBlockedForPlacement(index:number):boolean{return !this.selectedMines().includes(index)&&this.selectedMines().some(selected=>areHideSeekCellsAdjacent(selected,index))}
 isRevealed(index:number):boolean{return this.isPlacement()&&!this.isShowingRoundResult()?false:!!this.round()?.revealed[index]}
 isMineVisible(index:number):boolean{
  if(this.selectedMines().includes(index))return true;
  if(this.isPlacement()&&!this.isShowingRoundResult())return false;
  const game=this.game(),round=this.round();if(!game||!round||!round.mines[index])return false;
  return round.revealed[index]||this.showingWonRound()||game.status!=='active'||(round.hiderUserId===this.currentUserId()&&this.showHiddenMines());
 }
 adjacent(index:number):number{return this.round()?countHideSeekAdjacentMines(this.round()!.mines,index):0}
 isLast(index:number):boolean{return !(this.isPlacement()&&!this.isShowingRoundResult())&&this.round()?.lastMove?.cellIndex===index}
 isExploded(index:number):boolean{return this.explodedMines().has(index)}
 isDefused(index:number):boolean{return this.defusedMines().has(index)}
 isShowingRoundResult():boolean{return this.showingLostRound()||this.showingWonRound()}
 isCurrentUserHider():boolean{return this.round()?.hiderUserId===this.currentUserId()}

 private animateLostRound(game:MinefieldHideSeekGame,round:MinefieldHideSeekRound):void{
  const mines=round.mines.flatMap((mine,index)=>mine?[index]:[]);
  this.showingLostRound.set(true);
  this.explodedMines.set(new Set());
  mines.forEach((mine,index)=>setTimeout(()=>{
   this.explodedMines.update(current=>new Set([...current,mine]));
   this.feedback.notifyExplosion(index);
  },index*280));
  if(game.phase==='placingSecond')setTimeout(()=>{
   if(this.game()?.phase==='placingSecond'){
    this.showingLostRound.set(false);
    this.explodedMines.set(new Set());
   }
  },mines.length*280+650);
 }
 private animateWonRound(game:MinefieldHideSeekGame,round:MinefieldHideSeekRound):void{
  const mines=round.mines.flatMap((mine,index)=>mine?[index]:[]);
  this.showingWonRound.set(true);
  this.defusedMines.set(new Set());
  mines.forEach((mine,index)=>setTimeout(()=>{
   this.defusedMines.update(current=>new Set([...current,mine]));
   this.feedback.notifyDefused(index);
  },index*280));
  if(game.phase==='placingSecond')setTimeout(()=>{
   if(this.game()?.phase==='placingSecond'){
    this.showingWonRound.set(false);
    this.defusedMines.set(new Set());
   }
  },mines.length*280+650);
 }
}
