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
 readonly animateInitialMine=input(false);
 readonly placementMode=input(false);
 readonly disabled=input(false);
 readonly showHiddenMines=input(false);
 readonly search=output<number>();
 readonly placement=output<number[]>();
 readonly placementChange=output<number[]>();
 readonly selectedMines=signal<number[]>([]);
 readonly explodedMines=signal<ReadonlySet<number>>(new Set());
 readonly detonatingMine=signal<number|null>(null);
 readonly defusedMines=signal<ReadonlySet<number>>(new Set());
 readonly showingLostRound=signal(false);
 readonly showingWonRound=signal(false);
 readonly roundResultAnimationComplete=signal(false);
 readonly cells=Array.from({length:HIDE_SEEK_CELL_COUNT},(_,index)=>index);
 readonly mineCount=HIDE_SEEK_MINE_COUNT;
 private observedMoveKey:string|null=null;
 private locallyAnimatedMine:number|null=null;

 constructor(){
  effect(()=>{
   const game=this.game(),round=this.round();
   if(!game||!round)return;
   const key=`${game.gameId}:${game.rounds.indexOf(round)}:${round.lastMove?.moveNumber??0}`;
   const completed=game.phase==='placingSecond'||game.phase==='finished';
   const won=completed&&!round.lost&&round.mines.every((mine,index)=>mine||round.revealed[index]);
   const firstObservation=this.observedMoveKey===null;
   if(firstObservation){
    this.observedMoveKey=key;
    this.showingLostRound.set(completed&&!!round.lost);
    this.showingWonRound.set(won);
    this.roundResultAnimationComplete.set(completed);
    if(won)this.defusedMines.set(new Set(round.mines.flatMap((mine,index)=>mine?[index]:[])));
    if(this.animateInitialMine()&&round.lastMove?.hitMine){
     void this.animateRevealedMine(round.lastMove.cellIndex,completed);
    }
    return;
   }
   if(this.observedMoveKey===key)return;
   this.observedMoveKey=key;
   this.showingLostRound.set(completed&&!!round.lost);
   this.showingWonRound.set(won);
   this.roundResultAnimationComplete.set(!completed);
   this.defusedMines.set(new Set());
   if(round.lastMove?.hitMine){
    if(this.locallyAnimatedMine===round.lastMove.cellIndex){
     this.locallyAnimatedMine=null;
     setTimeout(()=>{
      this.explodedMines.set(new Set());
      if(completed)this.roundResultAnimationComplete.set(true);
     },560);
    }else{
     void this.animateRevealedMine(round.lastMove.cellIndex,completed);
    }
   }else if(won){
    this.animateWonRound(round);
   }else if(completed){
    this.roundResultAnimationComplete.set(true);
   }
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
  if(this.disabled()||this.detonatingMine()!==null||!game||!round||round.revealed[index]||game.nextPlayerUserId!==this.currentUserId()||round.seekerUserId!==this.currentUserId())return;
  if(round.mines[index]){
   void this.animateMineAndSearch(index);
   return;
  }
  this.feedback.notifySelection();
  this.search.emit(index);
 }
 submitPlacement():void{if(this.selectedMines().length===HIDE_SEEK_MINE_COUNT)this.placement.emit([...this.selectedMines()])}
 isBlockedForPlacement(index:number):boolean{return !this.selectedMines().includes(index)&&this.selectedMines().some(selected=>areHideSeekCellsAdjacent(selected,index))}
 isRevealed(index:number):boolean{
  if(this.detonatingMine()===index||this.explodedMines().has(index))return true;
  return this.isPlacement()&&!this.isShowingRoundResult()?false:!!this.round()?.revealed[index];
 }
 isMineVisible(index:number):boolean{
  if(this.selectedMines().includes(index))return true;
  if(this.detonatingMine()===index||this.explodedMines().has(index))return true;
  if(this.isPlacement()&&!this.isShowingRoundResult())return false;
  const game=this.game(),round=this.round();if(!game||!round||!round.mines[index])return false;
  return round.revealed[index]||this.showingWonRound()||game.status!=='active'||(round.hiderUserId===this.currentUserId()&&this.showHiddenMines());
 }
 adjacent(index:number):number{return this.round()?countHideSeekAdjacentMines(this.round()!.mines,index):0}
 isLast(index:number):boolean{return !(this.isPlacement()&&!this.isShowingRoundResult())&&this.round()?.lastMove?.cellIndex===index}
 isExplosionAnimating(index:number):boolean{return this.explodedMines().has(index)}
 showsExplosion(index:number):boolean{return this.explodedMines().has(index)||(!!this.round()?.revealed[index]&&!!this.round()?.mines[index]&&this.detonatingMine()!==index)}
 isDefused(index:number):boolean{return this.defusedMines().has(index)}
 isShowingRoundResult():boolean{return this.showingLostRound()||this.showingWonRound()}
 isCurrentUserHider():boolean{return this.round()?.hiderUserId===this.currentUserId()}
 private async animateMineAndSearch(mine:number):Promise<void>{
  this.locallyAnimatedMine=mine;
  this.detonatingMine.set(mine);
  this.explodedMines.set(new Set());
  await this.feedback.notifyMineCountdown();
  if(this.disabled()||this.detonatingMine()!==mine)return;
  this.detonatingMine.set(null);
  this.explodedMines.set(new Set([mine]));
  this.feedback.notifyExplosion();
  this.search.emit(mine);
 }

 private async animateRevealedMine(mine:number,completed:boolean):Promise<void>{
  this.detonatingMine.set(mine);
  this.explodedMines.set(new Set());
  this.roundResultAnimationComplete.set(!completed);
  await this.feedback.notifyMineCountdown();
  if(this.disabled()||this.detonatingMine()!==mine)return;
  this.detonatingMine.set(null);
  this.explodedMines.set(new Set([mine]));
  this.feedback.notifyExplosion();
  setTimeout(()=>{
   this.explodedMines.set(new Set());
   if(completed)this.roundResultAnimationComplete.set(true);
  },560);
 }
 private animateWonRound(round:MinefieldHideSeekRound):void{
  const mines=round.mines.flatMap((mine,index)=>mine?[index]:[]);
  this.showingWonRound.set(true);
  this.roundResultAnimationComplete.set(false);
  this.defusedMines.set(new Set());
  mines.forEach((mine,index)=>setTimeout(()=>{
   this.defusedMines.update(current=>new Set([...current,mine]));
   this.feedback.notifyDefused(index);
  },index*280));
  setTimeout(()=>this.roundResultAnimationComplete.set(true),mines.length*280+650);
 }
}
