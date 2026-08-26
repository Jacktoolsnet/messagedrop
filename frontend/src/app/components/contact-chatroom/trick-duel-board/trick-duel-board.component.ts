import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { BlackjackCard, TrickDuelGame } from '../../../interfaces/chat-game';
import { CryptoData } from '../../../interfaces/crypto-data';
import { CryptoService } from '../../../services/crypto.service';
import { GameFeedbackService } from '../../../services/game-feedback.service';
import { UserService } from '../../../services/user.service';
import { createTrickDuelCommitment, isValidTrickDuelHand, trickDuelCardKey, usedTrickDuelCardKeys } from '../../../utils/trick-duel';

const cachedHands=new Map<string,BlackjackCard[]>();

@Component({selector:'app-trick-duel-board',standalone:true,imports:[MatIconModule,TranslocoPipe],templateUrl:'./trick-duel-board.component.html',styleUrl:'./trick-duel-board.component.css',changeDetection:ChangeDetectionStrategy.OnPush})
export class TrickDuelBoardComponent{
  readonly game=input<TrickDuelGame|null>(null);readonly currentUserId=input('');readonly disabled=input(false);readonly cardPlayed=output<BlackjackCard>();
  readonly hand=signal<BlackjackCard[]>([]);readonly loading=signal(false);readonly invalidHand=signal(false);
  private readonly crypto=inject(CryptoService);private readonly users=inject(UserService);private readonly feedback=inject(GameFeedbackService);private loadId=0;
  constructor(){effect(()=>{void this.loadHand(this.game(),this.currentUserId())})}
  availableCards(game:TrickDuelGame):BlackjackCard[]{const used=usedTrickDuelCardKeys(game,this.currentUserId());return this.hand().filter(card=>!used.has(trickDuelCardKey(card)))}
  canPlay(game:TrickDuelGame):boolean{return !this.disabled()&&!this.loading()&&!this.invalidHand()&&game.status==='active'&&game.nextPlayerUserId===this.currentUserId()}
  play(game:TrickDuelGame,card:BlackjackCard):void{if(!this.canPlay(game))return;this.feedback.notifySelection();this.cardPlayed.emit(card)}
  ownCurrentCard(game:TrickDuelGame):BlackjackCard|null{return this.currentUserId()===game.playerXUserId?game.playerXCard:game.playerOCard}
  opponentHasPlayed(game:TrickDuelGame):boolean{return !!(this.currentUserId()===game.playerXUserId?game.playerOCard:game.playerXCard)}
  lastOwnCard(game:TrickDuelGame):BlackjackCard|null{if(game.playerXCard||game.playerOCard)return null;const round=game.rounds.at(-1);return round?(this.currentUserId()===game.playerXUserId?round.playerXCard:round.playerOCard):null}
  lastOpponentCard(game:TrickDuelGame):BlackjackCard|null{if(game.playerXCard||game.playerOCard)return null;const round=game.rounds.at(-1);return round?(this.currentUserId()===game.playerXUserId?round.playerOCard:round.playerXCard):null}
  lastRoundWinner(game:TrickDuelGame):string|null{return game.rounds.at(-1)?.winnerUserId??null}
  ownScore(game:TrickDuelGame):number{return this.currentUserId()===game.playerXUserId?game.playerXScore:game.playerOScore}
  opponentScore(game:TrickDuelGame):number{return this.currentUserId()===game.playerXUserId?game.playerOScore:game.playerXScore}
  opponentCardsLeft(game:TrickDuelGame):number{return Math.max(0,7-game.rounds.length-(this.opponentHasPlayed(game)?1:0))}
  opponentCardSlots(game:TrickDuelGame):number[]{return Array.from({length:this.opponentCardsLeft(game)},(_,index)=>index)}
  suit(card:BlackjackCard):string{return card.suit==='hearts'?'♥':card.suit==='diamonds'?'♦':card.suit==='clubs'?'♣':'♠'}
  isRed(card:BlackjackCard):boolean{return card.suit==='hearts'||card.suit==='diamonds'}
  key(card:BlackjackCard):string{return trickDuelCardKey(card)}
  private async loadHand(game:TrickDuelGame|null,userId:string):Promise<void>{
    const id=++this.loadId,key=game&&userId?`${game.gameId}:${userId}`:'';this.hand.set(cachedHands.get(key)??[]);this.invalidHand.set(false);if(!game||!userId)return;
    const isX=userId===game.playerXUserId,encrypted=isX?game.encryptedPlayerXHand:userId===game.playerOUserId?game.encryptedPlayerOHand:'',commitment=isX?game.playerXCommitment:game.playerOCommitment;if(!encrypted)return;
    this.loading.set(true);try{const plain=await this.crypto.decrypt(this.users.getUser().cryptoKeyPair.privateKey,JSON.parse(encrypted) as CryptoData),hand=JSON.parse(plain);if(!isValidTrickDuelHand(hand)||await createTrickDuelCommitment(hand)!==commitment)throw new Error('invalid');if(id===this.loadId){cachedHands.set(key,hand);this.hand.set(hand)}}catch{if(id===this.loadId)this.invalidHand.set(true)}finally{if(id===this.loadId)this.loading.set(false)}
  }
}
