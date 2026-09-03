import {
  applyConnectFourMove,
  createConnectFourGame,
  getConnectFourWinner,
  getConnectFourWinningCellIndexes
} from './connect-four';

describe('connect-four', () => {
  it('drops the first red stone to the bottom of the selected column', () => {
    const game = createConnectFourGame('sender', 'recipient', 3);
    expect(game.board[38]).toBe('R');
    expect(game.nextPlayerUserId).toBe('recipient');
    expect(game.moves).toEqual([{ mark: 'R', cellIndex: 38 }]);
  });

  it('stacks stones and alternates players', () => {
    const game = createConnectFourGame('sender', 'recipient', 3);
    const next = applyConnectFourMove(game, 'recipient', 3)!;
    expect(next.board[31]).toBe('Y');
    expect(next.nextPlayerUserId).toBe('sender');
    expect(next.moves?.at(-1)).toEqual({ mark: 'Y', cellIndex: 31 });
  });

  it('detects horizontal, vertical and diagonal wins', () => {
    expect(getConnectFourWinner(Array(35).fill(null).concat(['R', 'R', 'R', 'R', null, null, null]))).toBe('R');
    expect(getConnectFourWinningCellIndexes(Array(35).fill(null).concat(['R', 'R', 'R', 'R', null, null, null])))
      .toEqual([35, 36, 37, 38]);
    const vertical = Array(42).fill(null);
    [14, 21, 28, 35].forEach((index) => vertical[index] = 'Y');
    expect(getConnectFourWinner(vertical)).toBe('Y');
    const diagonal = Array(42).fill(null);
    [14, 22, 30, 38].forEach((index) => diagonal[index] = 'R');
    expect(getConnectFourWinner(diagonal)).toBe('R');
  });

  it('removes the oldest own mark and lets marks above it fall in the vanishing variant', () => {
    const game = createConnectFourGame('sender', 'recipient', 0, 'vanishing');
    game.board = Array(42).fill(null);
    game.board[35] = 'R';
    game.board[28] = 'Y';
    game.board[36] = 'R';
    game.board[37] = 'Y';
    game.board[39] = 'R';
    game.board[38] = 'Y';
    game.board[41] = 'R';
    game.board[40] = 'Y';
    game.moves = [
      { mark: 'R', cellIndex: 35 }, { mark: 'Y', cellIndex: 28 },
      { mark: 'R', cellIndex: 36 }, { mark: 'Y', cellIndex: 37 },
      { mark: 'R', cellIndex: 39 }, { mark: 'Y', cellIndex: 38 },
      { mark: 'R', cellIndex: 41 }, { mark: 'Y', cellIndex: 40 }
    ];
    game.nextPlayerUserId = 'sender';
    game.moveNumber = 8;

    const next = applyConnectFourMove(game, 'sender', 6)!;

    expect(next.board[28]).toBeNull();
    expect(next.board[35]).toBe('Y');
    expect(next.board[34]).toBe('R');
    expect(next.board.filter(cell => cell === 'R').length).toBe(4);
    expect(next.moves?.find(move => move.mark === 'Y' && move.cellIndex === 35)).toBeTruthy();
  });
});
