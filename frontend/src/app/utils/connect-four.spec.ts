import { applyConnectFourMove, createConnectFourGame, getConnectFourWinner } from './connect-four';

describe('connect-four', () => {
  it('drops the first red stone to the bottom of the selected column', () => {
    const game = createConnectFourGame('sender', 'recipient', 3);
    expect(game.board[38]).toBe('R');
    expect(game.nextPlayerUserId).toBe('recipient');
  });

  it('stacks stones and alternates players', () => {
    const game = createConnectFourGame('sender', 'recipient', 3);
    const next = applyConnectFourMove(game, 'recipient', 3)!;
    expect(next.board[31]).toBe('Y');
    expect(next.nextPlayerUserId).toBe('sender');
  });

  it('detects horizontal, vertical and diagonal wins', () => {
    expect(getConnectFourWinner(Array(35).fill(null).concat(['R', 'R', 'R', 'R', null, null, null]))).toBe('R');
    const vertical = Array(42).fill(null);
    [14, 21, 28, 35].forEach((index) => vertical[index] = 'Y');
    expect(getConnectFourWinner(vertical)).toBe('Y');
    const diagonal = Array(42).fill(null);
    [14, 22, 30, 38].forEach((index) => diagonal[index] = 'R');
    expect(getConnectFourWinner(diagonal)).toBe('R');
  });
});
