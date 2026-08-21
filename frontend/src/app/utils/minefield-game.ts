import { MinefieldGame, TicTacToeMark } from '../interfaces/chat-game';

export const MINEFIELD_SIZE = 8;
export const MINEFIELD_CELL_COUNT = MINEFIELD_SIZE * MINEFIELD_SIZE;
export const MINEFIELD_MINE_COUNT = 10;

export function createMinefieldGame(
  playerXUserId: string,
  playerOUserId: string,
  firstCellIndex: number,
  random: () => number = Math.random
): MinefieldGame {
  if (!isCellIndex(firstCellIndex)) throw new Error('invalid_first_cell');
  const mines = createMineLayout(firstCellIndex, random);
  const emptyGame: MinefieldGame = {
    type: 'minefield', version: 1, gameId: crypto.randomUUID(), rows: 8, columns: 8,
    mines, revealedBy: Array(MINEFIELD_CELL_COUNT).fill(null),
    playerXUserId, playerOUserId, playerXScore: 0, playerOScore: 0,
    nextPlayerUserId: playerXUserId, status: 'active', winnerUserId: null,
    moveNumber: 0, lastMove: null
  };
  return applyMinefieldMove(emptyGame, playerXUserId, firstCellIndex)!;
}

export function applyMinefieldMove(game: MinefieldGame, userId: string, cellIndex: number): MinefieldGame | null {
  if (game.status !== 'active' || game.nextPlayerUserId !== userId || !isCellIndex(cellIndex)
    || game.revealedBy[cellIndex] || game.mines.length !== MINEFIELD_CELL_COUNT) return null;
  let mark: TicTacToeMark;
  if (userId === game.playerXUserId) mark = 'X';
  else if (userId === game.playerOUserId) mark = 'O';
  else return null;
  const hitMine = !!game.mines[cellIndex];
  const revealedBy = [...game.revealedBy];
  revealedBy[cellIndex] = mark;
  const delta = hitMine ? -2 : 1;
  const playerXScore = game.playerXScore + (mark === 'X' ? delta : 0);
  const playerOScore = game.playerOScore + (mark === 'O' ? delta : 0);
  const finished = game.mines.every((mine, index) => mine || !!revealedBy[index]);
  const status = finished ? (playerXScore === playerOScore ? 'draw' : 'won') : 'active';
  const winnerUserId = status === 'won'
    ? playerXScore > playerOScore ? game.playerXUserId : game.playerOUserId
    : null;
  const moveNumber = game.moveNumber + 1;
  return {
    ...game,
    revealedBy,
    playerXScore,
    playerOScore,
    nextPlayerUserId: finished ? null : otherPlayer(game, userId),
    status,
    winnerUserId,
    moveNumber,
    lastMove: { playerUserId: userId, cellIndex, hitMine, adjacentMines: countAdjacentMines(game.mines, cellIndex), moveNumber }
  };
}

export function countAdjacentMines(mines: boolean[], cellIndex: number): number {
  const row = Math.floor(cellIndex / MINEFIELD_SIZE);
  const column = cellIndex % MINEFIELD_SIZE;
  let count = 0;
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      if (!rowOffset && !columnOffset) continue;
      const neighborRow = row + rowOffset;
      const neighborColumn = column + columnOffset;
      if (neighborRow >= 0 && neighborRow < MINEFIELD_SIZE && neighborColumn >= 0 && neighborColumn < MINEFIELD_SIZE
        && mines[neighborRow * MINEFIELD_SIZE + neighborColumn]) count += 1;
    }
  }
  return count;
}

export function createMineLayout(firstCellIndex: number, random: () => number = Math.random): boolean[] {
  const excluded = new Set<number>([firstCellIndex]);
  const firstRow = Math.floor(firstCellIndex / MINEFIELD_SIZE);
  const firstColumn = firstCellIndex % MINEFIELD_SIZE;
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      const row = firstRow + rowOffset;
      const column = firstColumn + columnOffset;
      if (row >= 0 && row < MINEFIELD_SIZE && column >= 0 && column < MINEFIELD_SIZE) excluded.add(row * MINEFIELD_SIZE + column);
    }
  }
  const candidates = Array.from({ length: MINEFIELD_CELL_COUNT }, (_, index) => index).filter(index => !excluded.has(index));
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
  }
  const mines = Array(MINEFIELD_CELL_COUNT).fill(false) as boolean[];
  candidates.slice(0, MINEFIELD_MINE_COUNT).forEach(index => { mines[index] = true; });
  return mines;
}

function isCellIndex(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < MINEFIELD_CELL_COUNT;
}

function otherPlayer(game: MinefieldGame, userId: string): string {
  return userId === game.playerXUserId ? game.playerOUserId : game.playerXUserId;
}
