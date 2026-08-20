import { TicTacToeCell, TicTacToeGame, TicTacToeMark } from '../interfaces/chat-game';

const WINNING_LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

export function normalizeTicTacToeBoard(board: readonly TicTacToeCell[]): TicTacToeCell[] {
  return Array.from({ length: 9 }, (_, index) => {
    const cell = board[index];
    return cell === 'X' || cell === 'O' ? cell : null;
  });
}

export function getTicTacToeWinner(board: readonly TicTacToeCell[]): TicTacToeMark | null {
  const normalized = normalizeTicTacToeBoard(board);
  for (const [first, second, third] of WINNING_LINES) {
    const mark = normalized[first];
    if (mark && mark === normalized[second] && mark === normalized[third]) {
      return mark;
    }
  }
  return null;
}

export function createTicTacToeGame(
  playerXUserId: string,
  playerOUserId: string,
  firstCell: number
): TicTacToeGame {
  const board = Array<TicTacToeCell>(9).fill(null);
  if (!Number.isInteger(firstCell) || firstCell < 0 || firstCell >= board.length) {
    throw new Error('invalid_first_move');
  }
  board[firstCell] = 'X';
  return {
    type: 'ticTacToe',
    version: 1,
    gameId: crypto.randomUUID(),
    board,
    playerXUserId,
    playerOUserId,
    nextPlayerUserId: playerOUserId,
    status: 'active',
    winnerUserId: null,
    moveNumber: 1
  };
}

export function applyTicTacToeMove(
  game: TicTacToeGame,
  userId: string,
  cellIndex: number
): TicTacToeGame | null {
  const board = normalizeTicTacToeBoard(game.board);
  if (
    game.status !== 'active'
    || game.nextPlayerUserId !== userId
    || !Number.isInteger(cellIndex)
    || cellIndex < 0
    || cellIndex >= board.length
    || board[cellIndex] !== null
  ) {
    return null;
  }

  const mark: TicTacToeMark | null = userId === game.playerXUserId
    ? 'X'
    : userId === game.playerOUserId
      ? 'O'
      : null;
  if (!mark) {
    return null;
  }

  board[cellIndex] = mark;
  const winner = getTicTacToeWinner(board);
  const moveNumber = board.filter(Boolean).length;
  if (winner) {
    return {
      ...game,
      board,
      moveNumber,
      status: 'won',
      winnerUserId: winner === 'X' ? game.playerXUserId : game.playerOUserId,
      nextPlayerUserId: null
    };
  }
  if (board.every(Boolean)) {
    return {
      ...game,
      board,
      moveNumber,
      status: 'draw',
      winnerUserId: null,
      nextPlayerUserId: null
    };
  }

  return {
    ...game,
    board,
    moveNumber,
    nextPlayerUserId: mark === 'X' ? game.playerOUserId : game.playerXUserId
  };
}
