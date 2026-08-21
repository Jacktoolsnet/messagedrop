import {
  applyTicTacToeMove,
  createTicTacToeGame,
  getTicTacToeWinner,
  getTicTacToeWinningCellIndexes
} from './tic-tac-toe';

describe('tic-tac-toe', () => {
  it('starts with the sender as X and the recipient next', () => {
    const game = createTicTacToeGame('sender', 'recipient', 4);
    expect(game.board[4]).toBe('X');
    expect(game.nextPlayerUserId).toBe('recipient');
    expect(game.moveNumber).toBe(1);
  });

  it('only accepts a move from the active player on an empty cell', () => {
    const game = createTicTacToeGame('sender', 'recipient', 4);
    expect(applyTicTacToeMove(game, 'sender', 0)).toBeNull();
    expect(applyTicTacToeMove(game, 'recipient', 4)).toBeNull();
    expect(applyTicTacToeMove(game, 'recipient', 0)?.board[0]).toBe('O');
  });

  it('detects wins and draws', () => {
    expect(getTicTacToeWinner(['X', 'X', 'X', null, 'O', null, 'O', null, null])).toBe('X');
    expect(getTicTacToeWinningCellIndexes(['X', 'X', 'X', null, 'O', null, 'O', null, null])).toEqual([0, 1, 2]);

    const game = createTicTacToeGame('sender', 'recipient', 0);
    game.board = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', null];
    game.nextPlayerUserId = 'sender';
    game.moveNumber = 8;
    const draw = applyTicTacToeMove(game, 'sender', 8);
    expect(draw?.status).toBe('draw');
    expect(draw?.nextPlayerUserId).toBeNull();
  });

  it('removes a player\'s oldest stone when placing a fourth stone in the vanishing variant', () => {
    let game = createTicTacToeGame('sender', 'recipient', 0, 'vanishing');
    game = applyTicTacToeMove(game, 'recipient', 4)!;
    game = applyTicTacToeMove(game, 'sender', 2)!;
    game = applyTicTacToeMove(game, 'recipient', 1)!;
    game = applyTicTacToeMove(game, 'sender', 7)!;
    game = applyTicTacToeMove(game, 'recipient', 6)!;
    game = applyTicTacToeMove(game, 'sender', 8)!;

    expect(game.board[0]).toBeNull();
    expect(game.board[8]).toBe('X');
    expect(game.board.filter((cell) => cell === 'X').length).toBe(3);
    expect(game.status).toBe('active');
  });
});
