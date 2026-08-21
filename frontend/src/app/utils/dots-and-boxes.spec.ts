import { applyDotsAndBoxesMove, createEmptyDotsAndBoxesGame } from './dots-and-boxes';

describe('dots-and-boxes', () => {
  it('alternates players when no box is completed', () => {
    const game = createEmptyDotsAndBoxesGame('sender', 'recipient');
    const next = applyDotsAndBoxesMove(game, 'sender', { orientation: 'horizontal', index: 0 });
    expect(next?.nextPlayerUserId).toBe('recipient');
  });

  it('claims a completed box and gives the player another move', () => {
    const game = createEmptyDotsAndBoxesGame('sender', 'recipient');
    game.horizontalEdges[0] = true;
    game.horizontalEdges[3] = true;
    game.verticalEdges[0] = true;
    game.nextPlayerUserId = 'sender';
    const next = applyDotsAndBoxesMove(game, 'sender', { orientation: 'vertical', index: 1 });
    expect(next?.boxes[0]).toBe('X');
    expect(next?.nextPlayerUserId).toBe('sender');
  });

  it('rejects an edge that is already occupied', () => {
    const game = createEmptyDotsAndBoxesGame('sender', 'recipient');
    game.horizontalEdges[0] = true;
    expect(applyDotsAndBoxesMove(game, 'sender', { orientation: 'horizontal', index: 0 })).toBeNull();
  });
});
