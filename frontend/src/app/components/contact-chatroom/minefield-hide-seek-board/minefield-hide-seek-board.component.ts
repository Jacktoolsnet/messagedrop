import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
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
 readonly cells=Array.from({length:HIDE_SEEK_CELL_COUNT},(_,index)=>index);
 readonly mineCount=HIDE_SEEK_MINE_COUNT;

 round():MinefieldHideSeekRound|null{return this.game()?currentHideSeekRound(this.game()!):null}
 isPlacement():boolean{return this.placementMode()||this.game()?.phase==='placingSecond'}
 toggleMine(index:number):void{
  if(this.disabled()||!this.isPlacement())return;
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
 isRevealed(index:number):boolean{return !!this.round()?.revealed[index]}
 isMineVisible(index:number):boolean{
  if(this.selectedMines().includes(index))return true;
  const game=this.game(),round=this.round();if(!game||!round||!round.mines[index])return false;
  return round.revealed[index]||game.status!=='active'||(round.hiderUserId===this.currentUserId()&&this.showHiddenMines());
 }
 adjacent(index:number):number{return this.round()?countHideSeekAdjacentMines(this.round()!.mines,index):0}
 isLast(index:number):boolean{return this.round()?.lastMove?.cellIndex===index}
}
