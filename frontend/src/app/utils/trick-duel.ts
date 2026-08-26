import { BlackjackCard, BlackjackRank, BlackjackSuit, TrickDuelGame } from '../interfaces/chat-game';

const SUITS: BlackjackSuit[]=['hearts','diamonds','clubs','spades'];
const RANKS: BlackjackRank[]=['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

export function createTrickDuelHands():{playerXHand:BlackjackCard[];playerOHand:BlackjackCard[]}{
  const deck=SUITS.flatMap(suit=>RANKS.map(rank=>({suit,rank})));
  for(let index=deck.length-1;index>0;index--){const other=secureRandomIndex(index+1);[deck[index],deck[other]]=[deck[other],deck[index]]}
  return{playerXHand:deck.slice(0,7),playerOHand:deck.slice(7,14)};
}

export async function createTrickDuelCommitment(hand:BlackjackCard[]):Promise<string>{
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(hand)));
  return Array.from(new Uint8Array(hash),value=>value.toString(16).padStart(2,'0')).join('');
}

export function isValidTrickDuelHand(hand:unknown):hand is BlackjackCard[]{
  if(!Array.isArray(hand)||hand.length!==7)return false;
  if(!hand.every(card=>isCard(card)))return false;
  const keys=new Set(hand.map(card=>cardKey(card)));
  return keys.size===7;
}

export function createTrickDuelGame(x:string,o:string,encryptedX:string,commitmentX:string,encryptedO:string,commitmentO:string):TrickDuelGame{
  if(!x||!o||x===o||!encryptedX||!encryptedO||!commitmentX||!commitmentO)throw new Error('invalid_trick_duel');
  return{type:'trickDuel',version:1,gameId:crypto.randomUUID(),playerXUserId:x,playerOUserId:o,encryptedPlayerXHand:encryptedX,encryptedPlayerOHand:encryptedO,
    playerXCommitment:commitmentX,playerOCommitment:commitmentO,playerXCard:null,playerOCard:null,rounds:[],playerXScore:0,playerOScore:0,
    roundFirstPlayerUserId:x,nextPlayerUserId:x,status:'active',winnerUserId:null,moveNumber:0};
}

export function applyTrickDuelCard(game:TrickDuelGame,userId:string,card:BlackjackCard):TrickDuelGame|null{
  if(game.status!=='active'||game.nextPlayerUserId!==userId||!isCard(card))return null;
  const isX=userId===game.playerXUserId,isO=userId===game.playerOUserId;
  if(!isX&&!isO||(isX&&game.playerXCard)||(isO&&game.playerOCard)||usedCards(game,userId).has(cardKey(card)))return null;
  const playerXCard=isX?card:game.playerXCard,playerOCard=isO?card:game.playerOCard;
  if(!playerXCard||!playerOCard)return{...game,playerXCard,playerOCard,nextPlayerUserId:isX?game.playerOUserId:game.playerXUserId,moveNumber:game.moveNumber+1};
  const comparison=rankValue(playerXCard.rank)-rankValue(playerOCard.rank),roundWinner=comparison===0?null:comparison>0?game.playerXUserId:game.playerOUserId;
  const rounds=[...game.rounds,{playerXCard,playerOCard,winnerUserId:roundWinner}],playerXScore=game.playerXScore+(roundWinner===game.playerXUserId?1:0),playerOScore=game.playerOScore+(roundWinner===game.playerOUserId?1:0);
  if(rounds.length===7){const winner=playerXScore===playerOScore?null:playerXScore>playerOScore?game.playerXUserId:game.playerOUserId;return{...game,playerXCard:null,playerOCard:null,rounds,playerXScore,playerOScore,nextPlayerUserId:null,status:winner?'won':'draw',winnerUserId:winner,moveNumber:game.moveNumber+1}}
  const roundFirstPlayerUserId=game.roundFirstPlayerUserId===game.playerXUserId?game.playerOUserId:game.playerXUserId;
  return{...game,playerXCard:null,playerOCard:null,rounds,playerXScore,playerOScore,roundFirstPlayerUserId,nextPlayerUserId:roundFirstPlayerUserId,moveNumber:game.moveNumber+1};
}

export function usedTrickDuelCardKeys(game:TrickDuelGame,userId:string):Set<string>{return usedCards(game,userId)}
export function trickDuelCardKey(card:BlackjackCard):string{return cardKey(card)}

function usedCards(game:TrickDuelGame,userId:string):Set<string>{
  const isX=userId===game.playerXUserId,cards=game.rounds.map(round=>isX?round.playerXCard:round.playerOCard),current=isX?game.playerXCard:game.playerOCard;
  if(current)cards.push(current);return new Set(cards.map(cardKey));
}
function isCard(card:BlackjackCard):boolean{return !!card&&SUITS.includes(card.suit)&&RANKS.includes(card.rank)}
function cardKey(card:BlackjackCard):string{return `${card.suit}:${card.rank}`}
function rankValue(rank:BlackjackRank):number{return RANKS.indexOf(rank)+2}
function secureRandomIndex(max:number):number{const range=0x1_0000_0000,limit=Math.floor(range/max)*max,value=new Uint32Array(1);do crypto.getRandomValues(value);while(value[0]>=limit);return value[0]%max}
