import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { BlackjackCard, BlackjackGame } from '../../../interfaces/chat-game';
import { CryptoData } from '../../../interfaces/crypto-data';
import { CryptoService } from '../../../services/crypto.service';
import { GameFeedbackService } from '../../../services/game-feedback.service';
import { UserService } from '../../../services/user.service';
import { BlackjackAction, blackjackValue, createBlackjackCommitment, isValidBlackjackSecret } from '../../../utils/blackjack';

export type BlackjackUiAction='setup'|BlackjackAction;
@Component({selector:'app-blackjack-board',standalone:true,imports:[MatButtonModule,MatIconModule,TranslocoPipe],templateUrl:'./blackjack-board.component.html',styleUrl:'./blackjack-board.component.css',changeDetection:ChangeDetectionStrategy.OnPush})
export class BlackjackBoardComponent{
  readonly game=input<BlackjackGame|null>(null);readonly currentUserId=input('');readonly disabled=input(false);readonly action=output<BlackjackUiAction>();
  readonly ownHand=signal<BlackjackCard[]>([]);readonly loading=signal(false);readonly invalidSecret=signal(false);
  private readonly cryptoService=inject(CryptoService);private readonly userService=inject(UserService);private readonly feedback=inject(GameFeedbackService);private loadId=0;private readonly autoStandKeys=new Set<string>();
  constructor(){effect(()=>{const game=this.game(),userId=this.currentUserId();void this.loadOwnHand(game,userId)})}
  shownOwnHand(game:BlackjackGame):BlackjackCard[]|null{
    if(game.status==='active')return this.ownHand();
    return this.currentUserId()===game.playerXUserId?game.revealedPlayerXHand:game.revealedPlayerOHand;
  }
  shownOpponentHand(game:BlackjackGame):BlackjackCard[]|null{
    if(game.status==='active')return null;
    return this.currentUserId()===game.playerXUserId?game.revealedPlayerOHand:game.revealedPlayerXHand;
  }
  isOwnWinner(game:BlackjackGame):boolean{return game.status==='won'&&game.winnerUserId===this.currentUserId()}
  isOpponentWinner(game:BlackjackGame):boolean{return game.status==='won'&&game.winnerUserId!==this.currentUserId()}
  value(hand:BlackjackCard[]|null):number|null{return hand?.length?blackjackValue(hand):null}
  suit(card:BlackjackCard):string{return card.suit==='hearts'?'♥':card.suit==='diamonds'?'♦':card.suit==='clubs'?'♣':'♠'}
  isRed(card:BlackjackCard):boolean{return card.suit==='hearts'||card.suit==='diamonds'}
  emit(action:BlackjackUiAction):void{if(this.disabled())return;this.feedback.notifySelection();this.action.emit(action)}
  private async loadOwnHand(game:BlackjackGame|null,userId:string):Promise<void>{
    const id=++this.loadId;this.ownHand.set([]);this.invalidSecret.set(false);if(!game||!userId||game.status!=='active')return;
    const isX=userId===game.playerXUserId,encrypted=isX?game.encryptedPlayerXDeck:userId===game.playerOUserId?game.encryptedPlayerODeck:null;
    const commitment=isX?game.playerXCommitment:game.playerOCommitment,count=isX?game.playerXDrawCount:game.playerODrawCount;if(!encrypted||!commitment)return;
    this.loading.set(true);try{const plain=await this.cryptoService.decrypt(this.userService.getUser().cryptoKeyPair.privateKey,JSON.parse(encrypted) as CryptoData);const secret=JSON.parse(plain);if(!isValidBlackjackSecret(secret)||await createBlackjackCommitment(secret)!==commitment)throw new Error('invalid');if(id===this.loadId){const hand=secret.deck.slice(0,count);this.ownHand.set(hand);const ownTurn=game.nextPlayerUserId===userId&&((isX&&game.phase==='turnX')||(!isX&&game.phase==='turnO')),key=`${game.gameId}:${game.moveNumber}`;if(ownTurn&&blackjackValue(hand)>=21&&!this.autoStandKeys.has(key)){this.autoStandKeys.add(key);queueMicrotask(()=>this.action.emit('stand'))}}}catch{if(id===this.loadId)this.invalidSecret.set(true)}finally{if(id===this.loadId)this.loading.set(false)}
  }
}
