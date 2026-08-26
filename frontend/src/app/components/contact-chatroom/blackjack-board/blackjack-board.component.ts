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

const renderedBlackjackHands=new Map<string,BlackjackCard[]>();
export type BlackjackUiAction='setup'|BlackjackAction;
@Component({selector:'app-blackjack-board',standalone:true,imports:[MatButtonModule,MatIconModule,TranslocoPipe],templateUrl:'./blackjack-board.component.html',styleUrl:'./blackjack-board.component.css',changeDetection:ChangeDetectionStrategy.OnPush})
export class BlackjackBoardComponent{
  readonly game=input<BlackjackGame|null>(null);readonly currentUserId=input('');readonly disabled=input(false);readonly action=output<BlackjackUiAction>();
  readonly ownHand=signal<BlackjackCard[]>([]);readonly newlyDealtCards=signal(new Set<string>());readonly loading=signal(false);readonly invalidSecret=signal(false);
  private readonly cryptoService=inject(CryptoService);private readonly userService=inject(UserService);private readonly feedback=inject(GameFeedbackService);private loadId=0;private loadedGameId='';private loadedUserId='';private readonly automaticActionKeys=new Set<string>();
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
  canChooseAction(game:BlackjackGame):boolean{return game.status==='active'&&game.nextPlayerUserId===this.currentUserId()&&(game.phase==='turnX'||game.phase==='turnO')&&!this.loading()&&!this.invalidSecret()}
  value(hand:BlackjackCard[]|null):number|null{return hand?.length?blackjackValue(hand):null}
  suit(card:BlackjackCard):string{return card.suit==='hearts'?'♥':card.suit==='diamonds'?'♦':card.suit==='clubs'?'♣':'♠'}
  cardKey(card:BlackjackCard):string{return `${card.suit}:${card.rank}`}
  isNewlyDealt(card:BlackjackCard):boolean{return this.newlyDealtCards().has(this.cardKey(card))}
  isRed(card:BlackjackCard):boolean{return card.suit==='hearts'||card.suit==='diamonds'}
  emit(action:BlackjackUiAction):void{if(this.disabled())return;this.feedback.notifySelection();this.action.emit(action)}
  private async loadOwnHand(game:BlackjackGame|null,userId:string):Promise<void>{
    const id=++this.loadId,handKey=game&&userId?`${game.gameId}:${userId}`:'',newGame=!game||game.gameId!==this.loadedGameId||userId!==this.loadedUserId;if(newGame){this.ownHand.set(renderedBlackjackHands.get(handKey)??[]);this.newlyDealtCards.set(new Set());this.loadedGameId=game?.gameId??'';this.loadedUserId=userId}this.invalidSecret.set(false);if(!game||!userId||game.status!=='active')return;
    const isX=userId===game.playerXUserId,encrypted=isX?game.encryptedPlayerXDeck:userId===game.playerOUserId?game.encryptedPlayerODeck:null;
    const commitment=isX?game.playerXCommitment:game.playerOCommitment,count=isX?game.playerXDrawCount:game.playerODrawCount;if(!encrypted||!commitment)return;
    this.loading.set(true);try{const plain=await this.cryptoService.decrypt(this.userService.getUser().cryptoKeyPair.privateKey,JSON.parse(encrypted) as CryptoData);const secret=JSON.parse(plain);if(!isValidBlackjackSecret(secret)||await createBlackjackCommitment(secret)!==commitment)throw new Error('invalid');if(id===this.loadId){const hand=secret.deck.slice(0,count),previous=renderedBlackjackHands.get(handKey)??[],samePrefix=previous.length<=hand.length&&previous.every((card,index)=>this.cardKey(card)===this.cardKey(hand[index]));this.newlyDealtCards.set(new Set(hand.slice(samePrefix?previous.length:0).map((card:BlackjackCard)=>this.cardKey(card))));this.ownHand.set(hand);renderedBlackjackHands.set(handKey,hand);const ownTurn=game.nextPlayerUserId===userId&&((isX&&game.phase==='turnX')||(!isX&&game.phase==='turnO')),action:BlackjackAction|null=game.nextPlayerUserId===userId&&isX&&game.phase==='revealX'?'reveal':ownTurn&&blackjackValue(hand)>=21?'stand':null,key=`${game.gameId}:${game.moveNumber}:${action}`;if(action&&!this.automaticActionKeys.has(key)){this.automaticActionKeys.add(key);queueMicrotask(()=>this.action.emit(action))}}}catch{if(id===this.loadId)this.invalidSecret.set(true)}finally{if(id===this.loadId)this.loading.set(false)}
  }
}
