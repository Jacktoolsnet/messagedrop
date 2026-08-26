import { BlackjackCard, BlackjackGame, BlackjackRank, BlackjackSuit } from '../interfaces/chat-game';

export interface BlackjackSecret { deck: BlackjackCard[]; nonce: string; }
export type BlackjackAction = 'hit'|'stand'|'reveal';
const SUITS: BlackjackSuit[] = ['hearts','diamonds','clubs','spades'];
const RANKS: BlackjackRank[] = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

export function createBlackjackSecret(): BlackjackSecret {
  const deck = SUITS.flatMap(suit => RANKS.map(rank => ({ suit, rank })));
  for (let index=deck.length-1;index>0;index--) {
    const other=secureRandomIndex(index+1);[deck[index],deck[other]]=[deck[other],deck[index]];
  }
  return {deck,nonce:crypto.randomUUID()};
}
export async function createBlackjackCommitment(secret:BlackjackSecret):Promise<string>{
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(secret)));
  return Array.from(new Uint8Array(hash),value=>value.toString(16).padStart(2,'0')).join('');
}
export function isValidBlackjackSecret(secret:BlackjackSecret):boolean{
  if(!secret?.nonce||!Array.isArray(secret.deck)||secret.deck.length!==52)return false;
  const cards=new Set(secret.deck.map(card=>`${card.suit}:${card.rank}`));
  return cards.size===52&&secret.deck.every(card=>SUITS.includes(card.suit)&&RANKS.includes(card.rank));
}
export function createBlackjackGame(x:string,o:string,encryptedDeck:string,commitment:string):BlackjackGame{
  if(!x||!o||x===o||!encryptedDeck||!commitment)throw new Error('invalid_blackjack');
  return {type:'blackjack',version:1,gameId:crypto.randomUUID(),playerXUserId:x,playerOUserId:o,
    encryptedPlayerXDeck:encryptedDeck,playerXCommitment:commitment,encryptedPlayerODeck:null,playerOCommitment:null,
    playerXDrawCount:2,playerODrawCount:2,playerXDone:false,playerODone:false,
    revealedPlayerXHand:null,playerXRevealNonce:null,revealedPlayerOHand:null,playerORevealNonce:null,revealedPlayerXDeck:null,revealedPlayerODeck:null,
    phase:'setupO',nextPlayerUserId:o,status:'active',winnerUserId:null,moveNumber:0};
}
export function setupBlackjackOpponent(game:BlackjackGame,userId:string,encryptedDeck:string,commitment:string):BlackjackGame|null{
  if(game.phase!=='setupO'||game.nextPlayerUserId!==userId||userId!==game.playerOUserId||!encryptedDeck||!commitment)return null;
  return {...game,encryptedPlayerODeck:encryptedDeck,playerOCommitment:commitment,phase:'turnX',nextPlayerUserId:game.playerXUserId,moveNumber:game.moveNumber+1};
}
export function applyBlackjackAction(game:BlackjackGame,userId:string,action:BlackjackAction,secret:BlackjackSecret):BlackjackGame|null{
  if(game.status!=='active'||game.nextPlayerUserId!==userId||!isValidBlackjackSecret(secret))return null;
  const isX=userId===game.playerXUserId,isO=userId===game.playerOUserId;
  if(!isX&&!isO)return null;
  if(action==='reveal'){
    if(!isX||game.phase!=='revealX')return null;
    const xHand=secret.deck.slice(0,game.playerXDrawCount),oHand=game.revealedPlayerOHand;
    if(!oHand)return null;
    const winner=blackjackWinner(xHand,oHand,game.playerXUserId,game.playerOUserId);
    return {...game,revealedPlayerXHand:xHand,playerXRevealNonce:secret.nonce,revealedPlayerXDeck:secret.deck,phase:'finished',nextPlayerUserId:null,
      status:winner==='draw'?'draw':'won',winnerUserId:winner==='draw'?null:winner,moveNumber:game.moveNumber+1};
  }
  if((isX&&game.phase!=='turnX')||(isO&&game.phase!=='turnO'))return null;
  const currentCount=isX?game.playerXDrawCount:game.playerODrawCount;
  const nextCount=action==='hit'?currentCount+1:currentCount;
  if(nextCount>52)return null;
  const done=action==='stand'||blackjackValue(secret.deck.slice(0,nextCount))>=21;
  const updated:BlackjackGame={...game,
    playerXDrawCount:isX?nextCount:game.playerXDrawCount,playerODrawCount:isO?nextCount:game.playerODrawCount,
    playerXDone:isX?done:game.playerXDone,playerODone:isO?done:game.playerODone,moveNumber:game.moveNumber+1};
  if(!done)return updated;
  if(isX)return {...updated,phase:'turnO',nextPlayerUserId:game.playerOUserId};
  return {...updated,revealedPlayerOHand:secret.deck.slice(0,nextCount),playerORevealNonce:secret.nonce,revealedPlayerODeck:secret.deck,
    phase:'revealX',nextPlayerUserId:game.playerXUserId};
}
export function blackjackValue(hand:readonly BlackjackCard[]):number{
  let value=0,aces=0;for(const card of hand){if(card.rank==='A'){value+=11;aces++}else if(['J','Q','K'].includes(card.rank))value+=10;else value+=Number(card.rank)}
  while(value>21&&aces>0){value-=10;aces--}return value;
}
export function isNaturalBlackjack(hand:readonly BlackjackCard[]):boolean{return hand.length===2&&blackjackValue(hand)===21}
function blackjackWinner(x:BlackjackCard[],o:BlackjackCard[],xId:string,oId:string):string|'draw'{
  const xv=blackjackValue(x),ov=blackjackValue(o),xb=xv>21,ob=ov>21;if(xb&&ob)return'draw';if(xb)return oId;if(ob)return xId;
  const xn=isNaturalBlackjack(x),on=isNaturalBlackjack(o);if(xn!==on)return xn?xId:oId;return xv===ov?'draw':xv>ov?xId:oId;
}
function secureRandomIndex(max:number):number{const range=0x1_0000_0000,limit=Math.floor(range/max)*max,value=new Uint32Array(1);do crypto.getRandomValues(value);while(value[0]>=limit);return value[0]%max}
