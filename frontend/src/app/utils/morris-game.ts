import { MorrisGame, TicTacToeMark } from '../interfaces/chat-game';

export const MORRIS_POSITIONS=24;
export const MORRIS_ADJACENCY:number[][]=[
 [1,9],[0,2,4],[1,14],[4,10],[1,3,5,7],[4,13],[7,11],[4,6,8],[7,12],
 [0,10,21],[3,9,11,18],[6,10,15],[8,13,17],[5,12,14,20],[2,13,23],
 [11,16],[15,17,19],[12,16],[10,19],[16,18,20,22],[13,19],[9,22],[19,21,23],[14,22]
];
export const MORRIS_MILLS:number[][]=[
 [0,1,2],[3,4,5],[6,7,8],[9,10,11],[12,13,14],[15,16,17],[18,19,20],[21,22,23],
 [0,9,21],[3,10,18],[6,11,15],[1,4,7],[16,19,22],[8,12,17],[5,13,20],[2,14,23]
];
export type MorrisAction={type:'place';to:number}|{type:'move';from:number;to:number}|{type:'remove';position:number};

export function createMorrisGame(x:string,o:string,firstPosition:number):MorrisGame{
 const game:MorrisGame={type:'morris',version:1,gameId:crypto.randomUUID(),board:Array(24).fill(null),playerXUserId:x,playerOUserId:o,
  inHandX:9,inHandO:9,phase:'placing',nextPlayerUserId:x,status:'active',winnerUserId:null,moveNumber:0,lastMove:null};
 const result=applyMorrisAction(game,x,{type:'place',to:firstPosition});
 if(!result)throw new Error('invalid_first_position');return result;
}

export function applyMorrisAction(game:MorrisGame,userId:string,action:MorrisAction):MorrisGame|null{
 if(game.status!=='active'||game.nextPlayerUserId!==userId)return null;
 const mark=markFor(game,userId);if(!mark)return null;
 const opponent=mark==='X'?'O':'X';const board=[...game.board];let inHandX=game.inHandX,inHandO=game.inHandO;
 let from:number|null=null,to:number|null=null,removed:number|null=null;
 if(game.phase==='placing'){
  if(action.type!=='place'||!valid(action.to)||board[action.to]||hand(game,mark)<=0)return null;
  to=action.to;board[to]=mark;if(mark==='X')inHandX--;else inHandO--;
 }else if(game.phase==='moving'){
  if(action.type!=='move'||!valid(action.from)||!valid(action.to)||board[action.from]!==mark||board[action.to])return null;
  const canFly=pieces(board,mark)===3;if(!canFly&&!MORRIS_ADJACENCY[action.from].includes(action.to))return null;
  from=action.from;to=action.to;board[from]=null;board[to]=mark;
 }else{
  if(action.type!=='remove'||!removablePositions(game,mark).includes(action.position))return null;
  removed=action.position;board[removed]=null;
  const winner=inHandX===0&&inHandO===0&&winnerAfterTurn(game,board,opponent);
  const moveNumber=game.moveNumber+1;
  return {...game,board,phase:inHandX===0&&inHandO===0?'moving':'placing',nextPlayerUserId:winner?null:other(game,userId),status:winner?'won':'active',winnerUserId:winner?userId:null,
   moveNumber,lastMove:{playerUserId:userId,from:null,to:null,removed,moveNumber}};
 }
 const formed=to!==null&&isMill(board,to,mark);
 const placementDone=inHandX===0&&inHandO===0;
 const moveNumber=game.moveNumber+1;
 if(formed)return {...game,board,inHandX,inHandO,phase:'removing',nextPlayerUserId:userId,moveNumber,
  lastMove:{playerUserId:userId,from,to,removed:null,moveNumber}};
 const nextUser=other(game,userId);const winner=placementDone&&winnerAfterTurn(game,board,opponent);
 return {...game,board,inHandX,inHandO,phase:placementDone?'moving':'placing',nextPlayerUserId:winner?null:nextUser,
  status:winner?'won':'active',winnerUserId:winner?userId:null,moveNumber,lastMove:{playerUserId:userId,from,to,removed:null,moveNumber}};
}

export function validDestinations(game:MorrisGame,position:number):number[]{
 const mark=game.board[position];if(!mark)return[];const empty=game.board.flatMap((cell,index)=>cell?[]:[index]);
 return pieces(game.board,mark)===3?empty:MORRIS_ADJACENCY[position].filter(index=>!game.board[index]);
}
export function removablePositions(game:MorrisGame,removingMark:TicTacToeMark):number[]{
 const opponent=removingMark==='X'?'O':'X';const all=game.board.flatMap((cell,index)=>cell===opponent?[index]:[]);
 const outside=all.filter(index=>!isMill(game.board,index,opponent));return outside.length?outside:all;
}
export function isMill(board:MorrisGame['board'],position:number,mark:TicTacToeMark):boolean{
 return MORRIS_MILLS.some(mill=>mill.includes(position)&&mill.every(index=>board[index]===mark));
}
function winnerAfterTurn(game:MorrisGame,board:MorrisGame['board'],opponent:TicTacToeMark):boolean{
 if(pieces(board,opponent)<3)return true;
 return board.every((cell,index)=>cell!==opponent||validDestinations({...game,board},index).length===0);
}
function pieces(board:MorrisGame['board'],mark:TicTacToeMark):number{return board.filter(cell=>cell===mark).length}
function hand(game:MorrisGame,mark:TicTacToeMark):number{return mark==='X'?game.inHandX:game.inHandO}
function markFor(game:MorrisGame,userId:string):TicTacToeMark|null{return userId===game.playerXUserId?'X':userId===game.playerOUserId?'O':null}
function other(game:MorrisGame,userId:string):string{return userId===game.playerXUserId?game.playerOUserId:game.playerXUserId}
function valid(position:number):boolean{return Number.isInteger(position)&&position>=0&&position<24}
