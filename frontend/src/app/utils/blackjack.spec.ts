import { applyBlackjackAction, blackjackValue, createBlackjackGame, createBlackjackSecret, setupBlackjackOpponent } from './blackjack';

describe('blackjack duel',()=>{
  it('counts aces flexibly',()=>{expect(blackjackValue([{suit:'hearts',rank:'A'},{suit:'clubs',rank:'9'},{suit:'spades',rank:'A'}])).toBe(21)});
  it('starts the first turn immediately when both decks are ready',()=>{const game=createBlackjackGame('x','o','xdeck','xcommit','odeck','ocommit');expect(game.phase).toBe('turnX');expect(game.nextPlayerUserId).toBe('x')});
  it('sets up both private decks before the first turn',()=>{const game=createBlackjackGame('x','o','xdeck','xcommit');const ready=setupBlackjackOpponent(game,'o','odeck','ocommit')!;expect(ready.phase).toBe('turnX');expect(ready.nextPlayerUserId).toBe('x')});
  it('moves to the other player after standing',()=>{const secret=createBlackjackSecret();const game=setupBlackjackOpponent(createBlackjackGame('x','o','xdeck','xcommit'),'o','odeck','ocommit')!;const next=applyBlackjackAction(game,'x','stand',secret)!;expect(next.phase).toBe('turnO');expect(next.playerXDone).toBeTrue()});
});
