import{CoinTossGame}from'../interfaces/chat-game';
export function validCoinOption(value:string):boolean{return value.trim().length>0&&value.trim().length<=40}
export function createCoinToss(creatorUserId:string,flipperUserId:string,optionA:string,optionB:string):CoinTossGame{
 const a=optionA.trim(),b=optionB.trim();if(!creatorUserId||!flipperUserId||creatorUserId===flipperUserId||!validCoinOption(a)||!validCoinOption(b)||a.localeCompare(b,undefined,{sensitivity:'base'})===0)throw new Error('invalid_coin_toss');
 return{type:'coinToss',version:1,gameId:crypto.randomUUID(),creatorUserId,flipperUserId,optionA:a,optionB:b,result:null,nextPlayerUserId:flipperUserId,status:'active',winnerUserId:null,moveNumber:0};
}
export function flipCoin(game:CoinTossGame,userId:string,random:()=>number=secureRandom):CoinTossGame|null{
 if(game.status!=='active'||game.nextPlayerUserId!==userId||game.flipperUserId!==userId)return null;
 return{...game,result:random()<.5?'A':'B',nextPlayerUserId:null,status:'decided',moveNumber:1};
}
function secureRandom():number{const value=new Uint32Array(1);crypto.getRandomValues(value);return value[0]/0x1_0000_0000}
