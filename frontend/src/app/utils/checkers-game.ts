import{CheckersGame,CheckersPiece,TicTacToeMark}from'../interfaces/chat-game';
export interface CheckersAction{from:number;to:number}
export interface CheckersLegalMove extends CheckersAction{captured:number|null}
const SIZE=8,DIAGONALS=[[-1,-1],[-1,1],[1,-1],[1,1]] as const;

export function createCheckersGame(x:string,o:string,firstMove:CheckersAction):CheckersGame{
 const board:(CheckersPiece|null)[]=Array(64).fill(null);
 for(let row=0;row<3;row++)for(let col=0;col<8;col++)if((row+col)%2===1)board[row*8+col]={mark:'O',king:false};
 for(let row=5;row<8;row++)for(let col=0;col<8;col++)if((row+col)%2===1)board[row*8+col]={mark:'X',king:false};
 const game:CheckersGame={type:'checkers',version:1,gameId:crypto.randomUUID(),board,playerXUserId:x,playerOUserId:o,nextPlayerUserId:x,forcedPieceIndex:null,status:'active',winnerUserId:null,moveNumber:0,lastMove:null};
 const result=applyCheckersMove(game,x,firstMove);if(!result)throw new Error('invalid_first_move');return result;
}
export function applyCheckersMove(game:CheckersGame,userId:string,action:CheckersAction):CheckersGame|null{
 if(game.status!=='active'||game.nextPlayerUserId!==userId)return null;const mark=markFor(game,userId);if(!mark)return null;
 const legal=legalMoves(game,mark).find(move=>move.from===action.from&&move.to===action.to);if(!legal)return null;
 const board=game.board.map(piece=>piece?{...piece}:null),piece=board[legal.from]!;board[legal.from]=null;
 const capturedPiece=legal.captured!==null&&board[legal.captured]?{...board[legal.captured]!}:null;
 if(legal.captured!==null)board[legal.captured]=null;
 const row=Math.floor(legal.to/8);if(!piece.king&&((piece.mark==='X'&&row===0)||(piece.mark==='O'&&row===7)))piece.king=true;board[legal.to]=piece;
 const moveNumber=game.moveNumber+1;
 const continuingTurn=game.forcedPieceIndex!==null&&game.lastMove?.playerUserId===userId;
 const turnPath=continuingTurn&&game.lastMove?.turnPath?[...game.lastMove.turnPath,legal.to]:[legal.from,legal.to];
 const capturedPieces=continuingTurn?[...(game.lastMove?.capturedPieces??[])]:[];
 if(legal.captured!==null&&capturedPiece)capturedPieces.push({index:legal.captured,piece:capturedPiece});
 const lastMove={playerUserId:userId,from:legal.from,to:legal.to,captured:legal.captured,moveNumber,turnPath,capturedPieces};
 if(legal.captured!==null){const continuations=capturesFor(board,legal.to,piece);if(continuations.length)return{...game,board,forcedPieceIndex:legal.to,moveNumber,lastMove};}
 const opponent:TicTacToeMark=mark==='X'?'O':'X',next=other(game,userId);const probe={...game,board,forcedPieceIndex:null,nextPlayerUserId:next} as CheckersGame;
 const won=!board.some(value=>value?.mark===opponent)||legalMoves(probe,opponent).length===0;
 return{...game,board,forcedPieceIndex:null,nextPlayerUserId:won?null:next,status:won?'won':'active',winnerUserId:won?userId:null,moveNumber,lastMove};
}
export function legalMoves(game:CheckersGame,mark:TicTacToeMark):CheckersLegalMove[]{
 if(game.forcedPieceIndex!==null){const piece=game.board[game.forcedPieceIndex];return piece?.mark===mark?capturesFor(game.board,game.forcedPieceIndex,piece):[]}
 const captures=game.board.flatMap((piece,index)=>piece?.mark===mark?capturesFor(game.board,index,piece):[]);if(captures.length)return captures;
 return game.board.flatMap((piece,index)=>piece?.mark===mark?normalMoves(game.board,index,piece):[]);
}
function capturesFor(board:CheckersGame['board'],from:number,piece:CheckersPiece):CheckersLegalMove[]{
 const result:CheckersLegalMove[]=[],row=Math.floor(from/8),col=from%8;
 const directions=piece.king?DIAGONALS:DIAGONALS.filter(([dr])=>dr===(piece.mark==='X'?-1:1));
 for(const[dr,dc]of directions){if(!piece.king){const mr=row+dr,mc=col+dc,tr=row+2*dr,tc=col+2*dc;if(inside(tr,tc)&&inside(mr,mc)){const middle=mr*8+mc,to=tr*8+tc;if(board[middle]&&board[middle]!.mark!==piece.mark&&!board[to])result.push({from,to,captured:middle})}continue}
  let r=row+dr,c=col+dc,captured:number|null=null;while(inside(r,c)){const index=r*8+c,current=board[index];if(current){if(current.mark===piece.mark||captured!==null)break;captured=index}else if(captured!==null)result.push({from,to:index,captured});r+=dr;c+=dc}
 }
 return result;
}
function normalMoves(board:CheckersGame['board'],from:number,piece:CheckersPiece):CheckersLegalMove[]{
 const result:CheckersLegalMove[]=[],row=Math.floor(from/8),col=from%8,directions=piece.king?DIAGONALS:DIAGONALS.filter(([dr])=>dr===(piece.mark==='X'?-1:1));
 for(const[dr,dc]of directions){let r=row+dr,c=col+dc;while(inside(r,c)){const to=r*8+c;if(board[to])break;result.push({from,to,captured:null});if(!piece.king)break;r+=dr;c+=dc}}
 return result;
}
function inside(row:number,col:number){return row>=0&&row<SIZE&&col>=0&&col<SIZE}
function markFor(game:CheckersGame,user:string):TicTacToeMark|null{return user===game.playerXUserId?'X':user===game.playerOUserId?'O':null}
function other(game:CheckersGame,user:string){return user===game.playerXUserId?game.playerOUserId:game.playerXUserId}
