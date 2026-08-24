import{applyWordRescueAction,createWordRescueGame,visibleWordRescueCharacters}from'./word-rescue-game';
describe('word rescue',()=>{
  it('reveals every occurrence of a letter',()=>{const game=createWordRescueGame('a','b','Banane');const next=applyWordRescueAction(game,'b',{type:'letter',letter:'a'})!;expect(visibleWordRescueCharacters(next).join('')).toBe('AA');expect(next.wrongCount).toBe(0)});
  it('charges two errors for a wrong complete word',()=>{const game=createWordRescueGame('a','b','Insel');const next=applyWordRescueAction(game,'b',{type:'word',word:'Anker'})!;expect(next.wrongCount).toBe(2)});
  it('ends after eight errors and awards the creator',()=>{let game=createWordRescueGame('a','b','XY');for(const letter of ['A','B','C','D','E','F','G','H'])game=applyWordRescueAction(game,'b',{type:'letter',letter})!;expect(game.status).toBe('won');expect(game.winnerUserId).toBe('a')});
});
