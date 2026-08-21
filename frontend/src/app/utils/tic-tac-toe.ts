import {
  TicTacToeCell,
  TicTacToeGame,
  TicTacToeMark,
  TicTacToeMove,
  TicTacToeVariant
} from '../interfaces/chat-game';

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

export function getTicTacToeWinningCellIndexes(board: readonly TicTacToeCell[]): number[] {
  const normalized = normalizeTicTacToeBoard(board);
  const winner = getTicTacToeWinner(normalized);
  if (!winner) return [];

  const indexes = new Set<number>();
  for (const line of WINNING_LINES) {
    if (line.every(index => normalized[index] === winner)) {
      line.forEach(index => indexes.add(index));
    }
  }
  return [...indexes];
}

export function createTicTacToeGame(
  playerXUserId: string,
  playerOUserId: string,
  firstCell: number,
  variant: TicTacToeVariant = 'standard'
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
    moveNumber: 1,
    variant,
    moves: variant === 'vanishing' ? [{ mark: 'X', cellIndex: firstCell }] : undefined
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
  let moves = game.variant === 'vanishing' ? normalizeMoves(game, board, cellIndex) : undefined;
  if (game.variant === 'vanishing' && moves) {
    const ownMoves = moves.filter((move) => move.mark === mark);
    if (ownMoves.length >= 3) {
      const oldestMove = ownMoves[0];
      board[oldestMove.cellIndex] = null;
      moves = moves.filter((move) => move !== oldestMove);
    }
    board[cellIndex] = mark;
    moves.push({ mark, cellIndex });
  }
  const winner = getTicTacToeWinner(board);
  const moveNumber = game.moveNumber + 1;
  if (winner) {
    return {
      ...game,
      board,
      moveNumber,
      status: 'won',
      winnerUserId: winner === 'X' ? game.playerXUserId : game.playerOUserId,
      nextPlayerUserId: null,
      moves
    };
  }
  if (game.variant !== 'vanishing' && board.every(Boolean)) {
    return {
      ...game,
      board,
      moveNumber,
      status: 'draw',
      winnerUserId: null,
      nextPlayerUserId: null,
      moves
    };
  }

  return {
    ...game,
    board,
    moveNumber,
    moves,
    nextPlayerUserId: mark === 'X' ? game.playerOUserId : game.playerXUserId
  };
}

function normalizeMoves(
  game: TicTacToeGame,
  boardWithNewMove: readonly TicTacToeCell[],
  newCellIndex: number
): TicTacToeMove[] {
  const boardBeforeMove = normalizeTicTacToeBoard(boardWithNewMove);
  boardBeforeMove[newCellIndex] = null;
  const usedCells = new Set<number>();
  const moves = (game.moves ?? []).filter((move) => {
    const valid = Number.isInteger(move.cellIndex)
      && move.cellIndex >= 0
      && move.cellIndex < boardBeforeMove.length
      && boardBeforeMove[move.cellIndex] === move.mark
      && !usedCells.has(move.cellIndex);
    if (valid) {
      usedCells.add(move.cellIndex);
    }
    return valid;
  });

  for (let index = 0; index < boardBeforeMove.length; index += 1) {
    const mark = boardBeforeMove[index];
    if (mark && !usedCells.has(index)) {
      moves.push({ mark, cellIndex: index });
    }
  }
  return moves;
}
