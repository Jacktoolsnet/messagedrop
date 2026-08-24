import{TreasureCompassDirection,TreasureIslandItem,TreasureMapAction,TreasureMapGame}from'../interfaces/chat-game';
export const TREASURE_ROWS=7,TREASURE_COLUMNS=7,TREASURE_CELL_COUNT=49;
export const TREASURE_INVENTORY:Readonly<Record<TreasureIslandItem,number>>={treasure:5,bomb:4,prisoner:3,wine:3,bride:1,map:1,compass:1};
const TREASURE_CHEST='\u{1FA8E}',TREASURE_FALLBACK='💰',BROKEN_CHAIN='⛓️‍💥',PRISONER_FALLBACK='🔓';let treasureGlyph:string|undefined,prisonerGlyph:string|undefined;

export function getTreasureSymbol():string{
 if(treasureGlyph)return treasureGlyph;
 if(typeof document==='undefined')return TREASURE_FALLBACK;
 const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const context=canvas.getContext('2d');if(!context)return TREASURE_FALLBACK;
 context.font='48px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Noto Emoji",sans-serif';context.textBaseline='top';context.fillStyle='#000';context.fillText(TREASURE_CHEST,4,4);
 try{const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]>20&&Math.max(pixels[i],pixels[i+1],pixels[i+2])-Math.min(pixels[i],pixels[i+1],pixels[i+2])>10)return treasureGlyph=TREASURE_CHEST}}catch{return treasureGlyph=TREASURE_FALLBACK}
 return treasureGlyph=TREASURE_FALLBACK;
}

export function getPrisonerSymbol():string{
 if(prisonerGlyph)return prisonerGlyph;
 if(typeof document==='undefined')return PRISONER_FALLBACK;
 const context=document.createElement('canvas').getContext('2d');if(!context)return PRISONER_FALLBACK;
 context.font='48px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Noto Emoji",sans-serif';
 const combinedWidth=context.measureText(BROKEN_CHAIN).width,separateWidth=context.measureText('⛓️💥').width;
 return prisonerGlyph=combinedWidth<separateWidth*.8?BROKEN_CHAIN:PRISONER_FALLBACK;
}

export function validTreasureLayout(layout:(TreasureIslandItem|null)[]):boolean{
 if(layout.length!==TREASURE_CELL_COUNT||!layout.every(value=>value===null||Object.hasOwn(TREASURE_INVENTORY,value)))return false;
 return(Object.keys(TREASURE_INVENTORY)as TreasureIslandItem[]).every(item=>layout.filter(value=>value===item).length===TREASURE_INVENTORY[item]);
}
export function randomTreasureLayout(random:()=>number=Math.random):(TreasureIslandItem|null)[]{
 const items=(Object.keys(TREASURE_INVENTORY)as TreasureIslandItem[]).flatMap(item=>Array(TREASURE_INVENTORY[item]).fill(item));
 const cells=Array.from({length:TREASURE_CELL_COUNT},(_,index)=>index);
 for(let i=cells.length-1;i>0;i--){const j=Math.min(i,Math.floor(random()*(i+1)));[cells[i],cells[j]]=[cells[j],cells[i]]}
 const layout=Array<TreasureIslandItem|null>(TREASURE_CELL_COUNT).fill(null);items.forEach((item,index)=>layout[cells[index]]=item);return layout;
}
export function createTreasureMapGame(x:string,o:string,layout:(TreasureIslandItem|null)[]):TreasureMapGame{
 if(!validTreasureLayout(layout))throw new Error('invalid_treasure_layout');
 return{type:'treasureMap',version:1,gameId:crypto.randomUUID(),rows:7,columns:7,playerXUserId:x,playerOUserId:o,playerXLayout:[...layout],playerOLayout:null,
  playerXRevealed:Array(49).fill(false),playerORevealed:Array(49).fill(false),playerXAttacked:Array(49).fill(false),playerOAttacked:Array(49).fill(false),playerXScouted:Array(49).fill(false),playerOScouted:Array(49).fill(false),playerXPirates:4,playerOPirates:4,playerXParrots:4,playerOParrots:4,
  playerXDrunk:0,playerODrunk:0,playerXTreasures:0,playerOTreasures:0,phase:'placingO',nextPlayerUserId:o,planningPlayerUserId:null,status:'active',winnerUserId:null,moveNumber:0,lastMove:null};
}
export function placeTreasureMapOpponent(game:TreasureMapGame,userId:string,layout:(TreasureIslandItem|null)[]):TreasureMapGame|null{
 if(game.status!=='active'||game.phase!=='placingO'||game.playerOUserId!==userId||game.nextPlayerUserId!==userId||!validTreasureLayout(layout))return null;
 return{...game,playerOLayout:[...layout],phase:'active',nextPlayerUserId:game.playerXUserId,planningPlayerUserId:game.playerXUserId};
}
export function availableTreasurePirates(game:TreasureMapGame,userId:string):number{
 if(userId===game.playerXUserId)return Math.max(0,game.playerXPirates-game.playerXDrunk);
 if(userId===game.playerOUserId)return Math.max(0,game.playerOPirates-game.playerODrunk);return 0;
}
export function applyTreasureMapAction(game:TreasureMapGame,userId:string,action:TreasureMapAction,random:()=>number=Math.random):TreasureMapGame|null{
 if(game.status!=='active'||game.phase!=='active'||game.nextPlayerUserId!==userId||!game.playerOLayout)return null;
 const isX=userId===game.playerXUserId;if(!isX&&userId!==game.playerOUserId)return null;
 const pirates=availableTreasurePirates(game,userId),parrots=isX?game.playerXParrots:game.playerOParrots;
 if(action.type==='pass'){
  if(pirates>0||parrots>0)return null;
  const next={...game,playerXDrunk:isX?0:game.playerXDrunk,playerODrunk:isX?game.playerODrunk:0};return finishTurn(next,userId,action,[],[],null,null);
 }
 const defenderLayout=isX?game.playerOLayout:game.playerXLayout,revealed=[...(isX?game.playerORevealed:game.playerXRevealed)];
 if(action.type==='parrot'){
  if(!Number.isInteger(action.cellIndex)||action.cellIndex<0||action.cellIndex>=49)return null;
  if(parrots<=0)return null;const indices=neighbourhood(action.cellIndex),scouted=[...(isX?game.playerOScouted??Array(49).fill(false):game.playerXScouted??Array(49).fill(false))];indices.forEach(index=>scouted[index]=true);
  const next={...game,playerXParrots:isX?game.playerXParrots-1:game.playerXParrots,playerOParrots:isX?game.playerOParrots:game.playerOParrots-1,playerXDrunk:isX?0:game.playerXDrunk,playerODrunk:isX?game.playerODrunk:0,playerXScouted:isX?game.playerXScouted:scouted,playerOScouted:isX?scouted:game.playerOScouted};
  return finishTurn(next,userId,action,[],indices,null,null);
 }
 const raidCount=Math.min(pirates,revealed.filter(value=>!value).length);
 if(raidCount<=0||action.cellIndices.length!==raidCount||new Set(action.cellIndices).size!==action.cellIndices.length||action.cellIndices.some(index=>!Number.isInteger(index)||index<0||index>=49||revealed[index]))return null;
 const attacked=[...(isX?game.playerOAttacked??game.playerORevealed:game.playerXAttacked??game.playerXRevealed)];action.cellIndices.forEach(index=>attacked[index]=true);
 let next:TreasureMapGame={...game,playerXAttacked:isX?game.playerXAttacked:attacked,playerOAttacked:isX?attacked:game.playerOAttacked};if(isX)next.playerXDrunk=0;else next.playerODrunk=0;
 let mapRevealIndex:number|null=null,compassDirection:TreasureCompassDirection|null=null;const temporary:number[]=[],foundItems:TreasureIslandItem[]=[];
 for(const index of action.cellIndices){
  revealed[index]=true;const item=defenderLayout[index];if(!item)continue;foundItems.push(item);
  if(item==='treasure'){if(isX)next.playerXTreasures++;else next.playerOTreasures++}
  else if(item==='bomb'){if(isX)next.playerXPirates--;else next.playerOPirates--}
  else if(item==='prisoner'){if(isX)next.playerXPirates++;else next.playerOPirates++}
  else if(item==='wine'){if(isX)next.playerXDrunk++;else next.playerODrunk++}
  else if(item==='bride'){if(isX){next.playerXTreasures=0;hideTreasuresInPlace(revealed,defenderLayout)}else{next.playerOTreasures=0;hideTreasuresInPlace(revealed,defenderLayout)}}
  else if(item==='map'){const candidates=revealed.flatMap((value,i)=>!value?[i]:[]);if(candidates.length){mapRevealIndex=candidates[Math.min(candidates.length-1,Math.floor(random()*candidates.length))];temporary.push(mapRevealIndex)}}
  else if(item==='compass')compassDirection=nearestTreasureDirection(index,defenderLayout,revealed);
 }
 if(isX)next.playerORevealed=revealed;else next.playerXRevealed=revealed;
 const collected=isX?next.playerXTreasures:next.playerOTreasures,living=isX?next.playerXPirates:next.playerOPirates;
 if(collected>=TREASURE_INVENTORY.treasure)return win(next,userId,action,foundItems,temporary,mapRevealIndex,compassDirection);
 if(living<=0)return win(next,isX?game.playerOUserId:game.playerXUserId,action,foundItems,temporary,mapRevealIndex,compassDirection);
 return finishTurn(next,userId,action,foundItems,temporary,mapRevealIndex,compassDirection);
}
function finishTurn(game:TreasureMapGame,userId:string,action:TreasureMapAction,items:TreasureIslandItem[],temp:number[],map:number|null,compass:TreasureCompassDirection|null):TreasureMapGame{
 const isX=userId===game.playerXUserId,moveNumber=game.moveNumber+1;return{...game,nextPlayerUserId:isX?game.playerOUserId:game.playerXUserId,planningPlayerUserId:null,moveNumber,lastMove:{playerUserId:userId,action,foundItems:items,temporaryRevealIndices:temp,mapRevealIndex:map,compassDirection:compass,moveNumber}};
}
function win(game:TreasureMapGame,winner:string,action:TreasureMapAction,items:TreasureIslandItem[],temp:number[],map:number|null,compass:TreasureCompassDirection|null):TreasureMapGame{
 const moveNumber=game.moveNumber+1;return{...game,status:'won',winnerUserId:winner,nextPlayerUserId:null,planningPlayerUserId:null,moveNumber,lastMove:{playerUserId:action.type==='pass'?'':game.nextPlayerUserId!,action,foundItems:items,temporaryRevealIndices:temp,mapRevealIndex:map,compassDirection:compass,moveNumber}};
}
function hideTreasuresInPlace(revealed:boolean[],layout:(TreasureIslandItem|null)[]):void{revealed.forEach((_,index)=>{if(layout[index]==='treasure')revealed[index]=false})}
function neighbourhood(index:number):number[]{const row=Math.floor(index/7),col=index%7,result:number[]=[];for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){const r=row+dr,c=col+dc;if(r>=0&&r<7&&c>=0&&c<7)result.push(r*7+c)}return result}
function nearestTreasureDirection(from:number,layout:(TreasureIslandItem|null)[],revealed:boolean[]):TreasureCompassDirection|null{
 const targets=layout.flatMap((item,index)=>item==='treasure'&&!revealed[index]?[index]:[]);if(!targets.length)return null;const fr=Math.floor(from/7),fc=from%7;
 const target=targets.sort((a,b)=>distance(from,a)-distance(from,b))[0],dr=Math.sign(Math.floor(target/7)-fr),dc=Math.sign(target%7-fc);
 return({"-1,-1":'upLeft',"-1,0":'up',"-1,1":'upRight',"0,-1":'left',"0,0":'here',"0,1":'right',"1,-1":'downLeft',"1,0":'down',"1,1":'downRight'}as Record<string,TreasureCompassDirection>)[`${dr},${dc}`];
}
function distance(a:number,b:number):number{return Math.abs(Math.floor(a/7)-Math.floor(b/7))+Math.abs(a%7-b%7)}
