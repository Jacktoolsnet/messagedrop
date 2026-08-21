import {
  ConnectFourCell,
  ConnectFourGame,
  ConnectFourMove,
  ConnectFourVariant
} from '../interfaces/chat-game';

export const CONNECT_FOUR_COLUMNS = 7;
export const CONNECT_FOUR_ROWS = 6;
export const CONNECT_FOUR_CELL_COUNT = CONNECT_FOUR_COLUMNS * CONNECT_FOUR_ROWS;

export function normalizeConnectFourBoard(board: readonly ConnectFourCell[]): ConnectFourCell[] {
  return Array.from({ length: CONNECT_FOUR_CELL_COUNT }, (_, index) => {
    const cell = board[index];
    return cell === 'R' || cell === 'Y' ? cell : null;
  });
}

export function getConnectFourDropIndex(board: readonly ConnectFourCell[], column: number): number | null {
  if (!Number.isInteger(column) || column < 0 || column >= CONNECT_FOUR_COLUMNS) {
    return null;
  }
  const normalized = normalizeConnectFourBoard(board);
  for (let row = CONNECT_FOUR_ROWS - 1; row >= 0; row -= 1) {
    const index = row * CONNECT_FOUR_COLUMNS + column;
    if (normalized[index] === null) {
      return index;
    }
  }
  return null;
}

export function getConnectFourWinner(board: readonly ConnectFourCell[]): 'R' | 'Y' | null {
  const normalized = normalizeConnectFourBoard(board);
  const directions: readonly (readonly [number, number])[] = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let row = 0; row < CONNECT_FOUR_ROWS; row += 1) {
    for (let column = 0; column < CONNECT_FOUR_COLUMNS; column += 1) {
      const mark = normalized[row * CONNECT_FOUR_COLUMNS + column];
      if (!mark) continue;
      for (const [rowStep, columnStep] of directions) {
        const endRow = row + rowStep * 3;
        const endColumn = column + columnStep * 3;
        if (endRow < 0 || endRow >= CONNECT_FOUR_ROWS || endColumn < 0 || endColumn >= CONNECT_FOUR_COLUMNS) {
          continue;
        }
        let matches = true;
        for (let offset = 1; offset < 4; offset += 1) {
          const index = (row + rowStep * offset) * CONNECT_FOUR_COLUMNS + column + columnStep * offset;
          if (normalized[index] !== mark) {
            matches = false;
            break;
          }
        }
        if (matches) return mark;
      }
    }
  }
  return null;
}

export function getConnectFourWinningCellIndexes(board: readonly ConnectFourCell[]): number[] {
  const normalized = normalizeConnectFourBoard(board);
  const indexes = new Set<number>();
  const directions: readonly (readonly [number, number])[] = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let row = 0; row < CONNECT_FOUR_ROWS; row += 1) {
    for (let column = 0; column < CONNECT_FOUR_COLUMNS; column += 1) {
      const mark = normalized[row * CONNECT_FOUR_COLUMNS + column];
      if (!mark) continue;
      for (const [rowStep, columnStep] of directions) {
        const line = Array.from({ length: 4 }, (_, offset) => ({
          row: row + rowStep * offset,
          column: column + columnStep * offset
        }));
        if (line.every(cell =>
          cell.row >= 0 && cell.row < CONNECT_FOUR_ROWS
          && cell.column >= 0 && cell.column < CONNECT_FOUR_COLUMNS
          && normalized[cell.row * CONNECT_FOUR_COLUMNS + cell.column] === mark
        )) {
          line.forEach(cell => indexes.add(cell.row * CONNECT_FOUR_COLUMNS + cell.column));
        }
      }
    }
  }
  return [...indexes];
}

export function createConnectFourGame(
  playerRedUserId: string,
  playerYellowUserId: string,
  firstColumn: number,
  variant: ConnectFourVariant = 'standard'
): ConnectFourGame {
  const board = Array<ConnectFourCell>(CONNECT_FOUR_CELL_COUNT).fill(null);
  const dropIndex = getConnectFourDropIndex(board, firstColumn);
  if (dropIndex === null) throw new Error('invalid_first_move');
  board[dropIndex] = 'R';
  return {
    type: 'connectFour',
    version: 1,
    gameId: crypto.randomUUID(),
    board,
    playerRedUserId,
    playerYellowUserId,
    nextPlayerUserId: playerYellowUserId,
    status: 'active',
    winnerUserId: null,
    moveNumber: 1,
    variant,
    moves: variant === 'vanishing' ? [{ mark: 'R', cellIndex: dropIndex }] : undefined
  };
}

export function applyConnectFourMove(
  game: ConnectFourGame,
  userId: string,
  column: number
): ConnectFourGame | null {
  if (game.status !== 'active' || game.nextPlayerUserId !== userId) return null;
  const board = normalizeConnectFourBoard(game.board);
  const mark = userId === game.playerRedUserId ? 'R' : userId === game.playerYellowUserId ? 'Y' : null;
  if (!mark) return null;
  let moves = game.variant === 'vanishing' ? normalizeConnectFourMoves(game, board) : undefined;
  if (game.variant === 'vanishing' && moves) {
    const ownMoves = moves.filter(move => move.mark === mark);
    if (ownMoves.length >= 4) {
      const oldestMove = ownMoves[0];
      board[oldestMove.cellIndex] = null;
      moves = moves.filter(move => move !== oldestMove);
      settleConnectFourColumn(board, moves, oldestMove.cellIndex % CONNECT_FOUR_COLUMNS);
    }
  }
  const dropIndex = getConnectFourDropIndex(board, column);
  if (dropIndex === null) return null;
  board[dropIndex] = mark;
  moves?.push({ mark, cellIndex: dropIndex });
  const winningMarks = new Set(getConnectFourWinningCellIndexes(board).map(index => board[index]).filter(Boolean));
  const moveNumber = game.moveNumber + 1;
  if (winningMarks.size > 1) {
    return { ...game, board, moveNumber, status: 'draw', winnerUserId: null, nextPlayerUserId: null, moves };
  }
  const winner = winningMarks.values().next().value as Exclude<ConnectFourCell, null> | undefined;
  if (winner) {
    return {
      ...game,
      board,
      moveNumber,
      status: 'won',
      winnerUserId: winner === 'R' ? game.playerRedUserId : game.playerYellowUserId,
      nextPlayerUserId: null,
      moves
    };
  }
  if (board.every(Boolean)) {
    return { ...game, board, moveNumber, status: 'draw', winnerUserId: null, nextPlayerUserId: null, moves };
  }
  return {
    ...game,
    board,
    moveNumber,
    moves,
    nextPlayerUserId: mark === 'R' ? game.playerYellowUserId : game.playerRedUserId
  };
}

function normalizeConnectFourMoves(game: ConnectFourGame, board: readonly ConnectFourCell[]): ConnectFourMove[] {
  const usedCells = new Set<number>();
  const moves = (game.moves ?? []).filter(move => {
    const valid = Number.isInteger(move.cellIndex)
      && move.cellIndex >= 0
      && move.cellIndex < board.length
      && board[move.cellIndex] === move.mark
      && !usedCells.has(move.cellIndex);
    if (valid) usedCells.add(move.cellIndex);
    return valid;
  }).map(move => ({ ...move }));

  for (let index = 0; index < board.length; index += 1) {
    const mark = board[index];
    if (mark && !usedCells.has(index)) moves.push({ mark, cellIndex: index });
  }
  return moves;
}

function settleConnectFourColumn(board: ConnectFourCell[], moves: ConnectFourMove[], column: number): void {
  const occupied = [] as Array<{ mark: Exclude<ConnectFourCell, null>; oldIndex: number }>;
  for (let row = CONNECT_FOUR_ROWS - 1; row >= 0; row -= 1) {
    const index = row * CONNECT_FOUR_COLUMNS + column;
    const mark = board[index];
    if (mark) occupied.push({ mark, oldIndex: index });
    board[index] = null;
  }

  occupied.forEach((cell, offset) => {
    const newIndex = (CONNECT_FOUR_ROWS - 1 - offset) * CONNECT_FOUR_COLUMNS + column;
    board[newIndex] = cell.mark;
    const move = moves.find(candidate => candidate.cellIndex === cell.oldIndex);
    if (move) move.cellIndex = newIndex;
  });
}
