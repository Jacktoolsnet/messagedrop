import { ConnectFourCell, ConnectFourGame } from '../interfaces/chat-game';

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

export function createConnectFourGame(
  playerRedUserId: string,
  playerYellowUserId: string,
  firstColumn: number
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
    lastMoveIndex: dropIndex
  };
}

export function applyConnectFourMove(
  game: ConnectFourGame,
  userId: string,
  column: number
): ConnectFourGame | null {
  if (game.status !== 'active' || game.nextPlayerUserId !== userId) return null;
  const board = normalizeConnectFourBoard(game.board);
  const dropIndex = getConnectFourDropIndex(board, column);
  if (dropIndex === null) return null;
  const mark = userId === game.playerRedUserId ? 'R' : userId === game.playerYellowUserId ? 'Y' : null;
  if (!mark) return null;
  board[dropIndex] = mark;
  const winner = getConnectFourWinner(board);
  const moveNumber = game.moveNumber + 1;
  if (winner) {
    return {
      ...game,
      board,
      moveNumber,
      status: 'won',
      winnerUserId: winner === 'R' ? game.playerRedUserId : game.playerYellowUserId,
      nextPlayerUserId: null,
      lastMoveIndex: dropIndex
    };
  }
  if (board.every(Boolean)) {
    return { ...game, board, moveNumber, status: 'draw', winnerUserId: null, nextPlayerUserId: null, lastMoveIndex: dropIndex };
  }
  return {
    ...game,
    board,
    moveNumber,
    lastMoveIndex: dropIndex,
    nextPlayerUserId: mark === 'R' ? game.playerYellowUserId : game.playerRedUserId
  };
}
