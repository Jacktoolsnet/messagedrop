import { applyTrickDuelCard, createTrickDuelGame, createTrickDuelHands } from './trick-duel';

describe('trick duel',()=>{
  it('deals two unique hands',()=>{const hands=createTrickDuelHands(),cards=[...hands.playerXHand,...hands.playerOHand].map(card=>`${card.suit}:${card.rank}`);expect(new Set(cards).size).toBe(14)});
  it('resolves a trick and alternates the first player',()=>{const game=createTrickDuelGame('x','o','xhand','xc','ohand','oc'),afterX=applyTrickDuelCard(game,'x',{suit:'hearts',rank:'K'})!,afterO=applyTrickDuelCard(afterX,'o',{suit:'clubs',rank:'10'})!;expect(afterO.playerXScore).toBe(1);expect(afterO.rounds.length).toBe(1);expect(afterO.nextPlayerUserId).toBe('o')});
  it('does not allow the same card twice',()=>{const game=createTrickDuelGame('x','o','xhand','xc','ohand','oc'),xCard={suit:'hearts',rank:'K'} as const,afterRound=applyTrickDuelCard(applyTrickDuelCard(game,'x',xCard)!,'o',{suit:'clubs',rank:'10'})!;applyTrickDuelCard(afterRound,'o',{suit:'clubs',rank:'9'});expect(applyTrickDuelCard({...afterRound,nextPlayerUserId:'x'},'x',xCard)).toBeNull()});
});
