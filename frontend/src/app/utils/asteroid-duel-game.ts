import { AsteroidDirection, AsteroidDuelAction, AsteroidDuelGame, TicTacToeMark } from '../interfaces/chat-game';

const SIZE = 7;
const CELL_COUNT = SIZE * SIZE;
const X_START = 6 * SIZE + 3;
const O_START = 3;
const STEP:Record<AsteroidDirection,readonly[number,number]> = {
  up:[-1,0], right:[0,1], down:[1,0], left:[0,-1]
};

export function createAsteroidField(random:()=>number=Math.random):boolean[]{
  const field=Array<boolean>(CELL_COUNT).fill(false);
  // Both pilots start behind an equally distant asteroid in the centre lane,
  // so the opening player cannot score an immediate unobstructed hit.
  field[17]=true;field[31]=true;
  const protectedCells=new Set([X_START,O_START, ...neighbours(X_START), ...neighbours(O_START)]);
  const pairs:Array<[number,number]>=[];
  for(let index=0;index<CELL_COUNT;index++){
    const mirror=CELL_COUNT-1-index;
    if(index>=mirror||field[index]||field[mirror]||protectedCells.has(index)||protectedCells.has(mirror))continue;
    pairs.push([index,mirror]);
  }
  for(let i=pairs.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pairs[i],pairs[j]]=[pairs[j],pairs[i]]}
  for(const[a,b]of pairs.slice(0,5)){field[a]=true;field[b]=true}
  return field;
}

export function createAsteroidDuelGame(x:string,o:string,asteroids:boolean[],firstAction:AsteroidDuelAction):AsteroidDuelGame{
  if(!validField(asteroids))throw new Error('invalid_asteroid_field');
  const game:AsteroidDuelGame={type:'asteroidDuel',version:1,gameId:crypto.randomUUID(),rows:7,columns:7,
    asteroids:[...asteroids],playerXUserId:x,playerOUserId:o,playerXPosition:X_START,playerOPosition:O_START,
    playerXShield:3,playerOShield:3,nextPlayerUserId:x,status:'active',winnerUserId:null,moveNumber:0,lastMove:null};
  const result=applyAsteroidDuelAction(game,x,firstAction);
  if(!result)throw new Error('invalid_first_action');
  return result;
}

export function createAsteroidDuelPreview(x:string,o:string,asteroids:boolean[]):AsteroidDuelGame{
  if(!validField(asteroids))throw new Error('invalid_asteroid_field');
  return{type:'asteroidDuel',version:1,gameId:'preview',rows:7,columns:7,asteroids:[...asteroids],
    playerXUserId:x,playerOUserId:o,playerXPosition:X_START,playerOPosition:O_START,playerXShield:3,playerOShield:3,
    nextPlayerUserId:x,status:'active',winnerUserId:null,moveNumber:0,lastMove:null};
}

export function applyAsteroidDuelAction(game:AsteroidDuelGame,userId:string,action:AsteroidDuelAction,random:()=>number=Math.random):AsteroidDuelGame|null{
  if(game.status!=='active'||game.nextPlayerUserId!==userId)return null;
  const mark=markFor(game,userId);if(!mark)return null;
  const from=mark==='X'?game.playerXPosition:game.playerOPosition;
  const opponentPosition=mark==='X'?game.playerOPosition:game.playerXPosition;
  const asteroids=[...game.asteroids];let to=from,path:number[]=[],destroyedAsteroid:number|null=null,hitPlayer=false;
  if(action.type==='move'){
    if(!legalMoveDestinations(game,userId).includes(action.to))return null;
    to=action.to;path=[to];
  }else{
    const [dr,dc]=STEP[action.direction];let row=Math.floor(from/SIZE)+dr,col=from%SIZE+dc;
    while(inside(row,col)){
      const index=row*SIZE+col;path.push(index);
      if(asteroids[index]){asteroids[index]=false;destroyedAsteroid=index;break}
      if(index===opponentPosition){hitPlayer=true;break}
      row+=dr;col+=dc;
    }
  }
  let playerXShield=game.playerXShield,playerOShield=game.playerOShield;
  if(hitPlayer){if(mark==='X')playerOShield--;else playerXShield--}
  const won=playerXShield<=0||playerOShield<=0;
  const moveNumber=game.moveNumber+1;
  const playerXPosition=mark==='X'?to:game.playerXPosition,playerOPosition=mark==='O'?to:game.playerOPosition;
  const driftedAsteroids=driftAsteroids(asteroids,playerXPosition,playerOPosition,new Set(path),random);
  return{...game,asteroids:driftedAsteroids,playerXPosition,playerOPosition,
    playerXShield,playerOShield,nextPlayerUserId:won?null:other(game,userId),status:won?'won':'active',winnerUserId:won?userId:null,
    moveNumber,lastMove:{playerUserId:userId,action:{...action},from,to,path,destroyedAsteroid,hitPlayer,moveNumber}};
}

export function legalMoveDestinations(game:AsteroidDuelGame,userId:string):number[]{
  const mark=markFor(game,userId);if(!mark||game.status!=='active'||game.nextPlayerUserId!==userId)return[];
  const from=mark==='X'?game.playerXPosition:game.playerOPosition;
  const occupied=mark==='X'?game.playerOPosition:game.playerXPosition;
  return neighbours(from).filter(index=>!game.asteroids[index]&&index!==occupied);
}

function neighbours(index:number):number[]{
  const row=Math.floor(index/SIZE),col=index%SIZE,result:number[]=[];
  for(const[dr,dc]of Object.values(STEP)){const r=row+dr,c=col+dc;if(inside(r,c))result.push(r*SIZE+c)}
  return result;
}
function driftAsteroids(field:boolean[],playerXPosition:number,playerOPosition:number,laserPath:Set<number>,random:()=>number):boolean[]{
  const next=[...field],sources=field.flatMap((occupied,index)=>occupied?[index]:[]);
  for(const source of sources){
    if(!next[source]||laserPath.has(source)||random()>=.34)continue;
    const destinations=neighbours(source).filter(index=>!next[index]&&index!==playerXPosition&&index!==playerOPosition&&!laserPath.has(index));
    if(!destinations.length)continue;
    const target=destinations[Math.min(destinations.length-1,Math.floor(random()*destinations.length))];
    next[source]=false;next[target]=true;
  }
  return next;
}
function validField(field:boolean[]):boolean{return field.length===CELL_COUNT&&!field[X_START]&&!field[O_START]}
function inside(row:number,col:number):boolean{return row>=0&&row<SIZE&&col>=0&&col<SIZE}
function markFor(game:AsteroidDuelGame,userId:string):TicTacToeMark|null{return userId===game.playerXUserId?'X':userId===game.playerOUserId?'O':null}
function other(game:AsteroidDuelGame,userId:string):string{return userId===game.playerXUserId?game.playerOUserId:game.playerXUserId}
