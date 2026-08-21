import { applyMinefieldMove, countAdjacentMines, createMineLayout, createMinefieldGame, MINEFIELD_MINE_COUNT } from './minefield-game';

describe('minefield game', () => {
  it('keeps the first cell and its neighbors safe', () => {
    const mines = createMineLayout(27, () => 0.42);
    expect(mines.filter(Boolean).length).toBe(MINEFIELD_MINE_COUNT);
    for (const index of [18,19,20,26,27,28,34,35,36]) expect(mines[index]).toBeFalse();
  });

  it('awards safe cells, penalizes mines and alternates turns', () => {
    const game = createMinefieldGame('x', 'o', 0, () => 0.3);
    expect(game.playerXScore).toBe(1);
    expect(game.nextPlayerUserId).toBe('o');
    const mineIndex = game.mines.findIndex(Boolean);
    const next = applyMinefieldMove(game, 'o', mineIndex)!;
    expect(next.playerOScore).toBe(-2);
    expect(next.nextPlayerUserId).toBe('x');
  });

  it('counts diagonal and orthogonal neighboring mines', () => {
    const mines = Array(64).fill(false) as boolean[];
    mines[0] = true; mines[2] = true; mines[9] = true;
    expect(countAdjacentMines(mines, 1)).toBe(3);
  });
});
