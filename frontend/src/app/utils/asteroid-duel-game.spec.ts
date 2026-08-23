import { applyAsteroidDuelAction, createAsteroidDuelGame, createAsteroidDuelPreview, createAsteroidField, legalMoveDestinations } from './asteroid-duel-game';

describe('asteroid duel',()=>{
  const empty=()=>Array<boolean>(49).fill(false);
  it('creates a symmetric field with protected starting areas',()=>{
    const field=createAsteroidField(()=>.42);
    expect(field.filter(Boolean).length).toBe(12);expect(field[3]).toBeFalse();expect(field[45]).toBeFalse();
    expect(field.every((value,index)=>value===field[48-index])).toBeTrue();
  });
  it('moves to a neighbouring free cell and changes the turn',()=>{
    const game=createAsteroidDuelGame('x','o',empty(),{type:'move',to:38});
    expect(game.playerXPosition).toBe(38);expect(game.nextPlayerUserId).toBe('o');
  });
  it('destroys the first asteroid in a laser path',()=>{
    const field=empty();field[31]=true;
    const game=createAsteroidDuelPreview('x','o',field);
    const next=applyAsteroidDuelAction(game,'x',{type:'fire',direction:'up'})!;
    expect(next.asteroids[31]).toBeFalse();expect(next.lastMove?.destroyedAsteroid).toBe(31);
  });
  it('damages the opponent and ends after the third hit',()=>{
    let game=createAsteroidDuelPreview('x','o',empty());
    game={...game,playerXPosition:10,playerOPosition:3,playerOShield:1};
    const next=applyAsteroidDuelAction(game,'x',{type:'fire',direction:'up'})!;
    expect(next.status).toBe('won');expect(next.winnerUserId).toBe('x');expect(next.playerOShield).toBe(0);
  });
  it('does not allow diagonal or occupied movement',()=>{
    const game=createAsteroidDuelPreview('x','o',empty());
    expect(legalMoveDestinations(game,'x')).toEqual([38,46,44]);
    expect(applyAsteroidDuelAction(game,'x',{type:'move',to:37})).toBeNull();
  });
});
