import{applyMorrisAction,createMorrisGame,removablePositions,validDestinations}from'./morris-game';
describe('morris game',()=>{
 it('forms a mill and requires a removal',()=>{let g=createMorrisGame('x','o',0);g=applyMorrisAction(g,'o',{type:'place',to:3})!;g=applyMorrisAction(g,'x',{type:'place',to:1})!;g=applyMorrisAction(g,'o',{type:'place',to:4})!;g=applyMorrisAction(g,'x',{type:'place',to:2})!;expect(g.phase).toBe('removing');expect(removablePositions(g,'X')).toEqual([3,4]);});
 it('allows flying with three pieces',()=>{const g={...createMorrisGame('x','o',0),phase:'moving' as const,inHandX:0,inHandO:0,board:Array(24).fill(null)};g.board[0]='X';g.board[1]='X';g.board[2]='X';expect(validDestinations(g,0)).toContain(23);});
});
