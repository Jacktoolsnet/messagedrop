import { applyMemoryTurn, createMemoryGame, memoryScore } from './memory-game';
import { MemorySymbol } from '../interfaces/chat-game';

describe('memory game', () => {
  const deck: MemorySymbol[] = ['pets','pets','forest','forest','star','star','favorite','favorite','music_note','music_note','flight','flight','restaurant','restaurant','sports_soccer','sports_soccer'];

  it('keeps the player on turn after finding a pair', () => {
    const game = createMemoryGame('x', 'o', deck, [0, 1]);
    expect(game.nextPlayerUserId).toBe('x');
    expect(memoryScore(game, 'X')).toBe(1);
    expect(game.lastMove?.matched).toBeTrue();
  });

  it('changes turns and persists a failed last move', () => {
    const game = createMemoryGame('x', 'o', deck, [0, 2]);
    expect(game.nextPlayerUserId).toBe('o');
    expect(game.lastMove).toEqual({ playerUserId: 'x', cardIndices: [0, 2], matched: false, moveNumber: 1 });
    expect(applyMemoryTurn(game, 'x', [4, 5])).toBeNull();
  });
});
