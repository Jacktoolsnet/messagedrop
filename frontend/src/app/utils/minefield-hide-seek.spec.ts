import { applyHideSeekSearch, applySecondMinePlacement, createMinefieldHideSeekGame, createPlacement } from './minefield-hide-seek';

describe('minefield hide and seek', () => {
  const placement=[0,2,4,18,20,22];
  it('rejects adjacent mines',()=>{expect(()=>createPlacement([0,1,4,18,20,22])).toThrow()});
  it('switches roles after all safe cells were found',()=>{
    let game=createMinefieldHideSeekGame('x','o',placement);
    for(let index=0;index<36;index+=1)if(!game.rounds[0].mines[index])game=applyHideSeekSearch(game,'o',index)!;
    expect(game.phase).toBe('placingSecond');
    game=applySecondMinePlacement(game,'o',placement)!;
    expect(game.phase).toBe('searchingSecond');expect(game.nextPlayerUserId).toBe('x');
  });
});
