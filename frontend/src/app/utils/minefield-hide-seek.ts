import { MinefieldHideSeekGame, MinefieldHideSeekRound } from '../interfaces/chat-game';

export const HIDE_SEEK_SIZE = 6;
export const HIDE_SEEK_CELL_COUNT = 36;
export const HIDE_SEEK_MINE_COUNT = 6;

export function createMinefieldHideSeekGame(
  playerXUserId: string,
  playerOUserId: string,
  mineIndices: number[]
): MinefieldHideSeekGame {
  const mines = createPlacement(mineIndices);
  return {
    type: 'minefieldHideSeek', version: 1, gameId: crypto.randomUUID(), rows: 6, columns: 6,
    playerXUserId, playerOUserId, phase: 'searchingFirst',
    rounds: [createRound(playerXUserId, playerOUserId, mines)],
    nextPlayerUserId: playerOUserId, status: 'active', winnerUserId: null, moveNumber: 0
  };
}

export function applyHideSeekSearch(game: MinefieldHideSeekGame, userId: string, cellIndex: number): MinefieldHideSeekGame | null {
  if (game.status !== 'active' || !isSearching(game) || game.nextPlayerUserId !== userId
    || !isCellIndex(cellIndex)) return null;
  const roundIndex = game.phase === 'searchingFirst' ? 0 : 1;
  const round = game.rounds[roundIndex];
  if (!round || round.seekerUserId !== userId || round.revealed[cellIndex]) return null;
  const revealed = [...round.revealed];
  revealed[cellIndex] = true;
  const hitMine = !!round.mines[cellIndex];
  const mistakes = round.mistakes + (hitMine ? 1 : 0);
  const moveNumber = game.moveNumber + 1;
  const nextRound: MinefieldHideSeekRound = {
    ...round, revealed, mistakes,
    lastMove: { playerUserId: userId, cellIndex, hitMine, adjacentMines: countHideSeekAdjacentMines(round.mines, cellIndex), moveNumber }
  };
  const rounds = game.rounds.map((value, index) => index === roundIndex ? nextRound : value);
  const complete = round.mines.every((mine, index) => mine || revealed[index]);
  if (!complete) return { ...game, rounds, moveNumber };
  if (roundIndex === 0) {
    return { ...game, rounds, phase: 'placingSecond', nextPlayerUserId: game.playerOUserId, moveNumber };
  }
  const playerOMistakes = rounds[0].mistakes;
  const playerXMistakes = rounds[1].mistakes;
  const status = playerXMistakes === playerOMistakes ? 'draw' : 'won';
  const winnerUserId = status === 'won'
    ? playerXMistakes < playerOMistakes ? game.playerXUserId : game.playerOUserId
    : null;
  return { ...game, rounds, phase: 'finished', nextPlayerUserId: null, status, winnerUserId, moveNumber };
}

export function applySecondMinePlacement(game: MinefieldHideSeekGame, userId: string, mineIndices: number[]): MinefieldHideSeekGame | null {
  if (game.status !== 'active' || game.phase !== 'placingSecond' || game.nextPlayerUserId !== userId
    || userId !== game.playerOUserId) return null;
  let mines: boolean[];
  try { mines = createPlacement(mineIndices); } catch { return null; }
  return {
    ...game,
    phase: 'searchingSecond',
    rounds: [...game.rounds, createRound(game.playerOUserId, game.playerXUserId, mines)],
    nextPlayerUserId: game.playerXUserId,
    moveNumber: game.moveNumber + 1
  };
}

export function createPlacement(indices: number[]): boolean[] {
  if (!Array.isArray(indices) || indices.length !== HIDE_SEEK_MINE_COUNT || new Set(indices).size !== HIDE_SEEK_MINE_COUNT
    || indices.some(index => !isCellIndex(index))) throw new Error('invalid_mine_placement');
  for (let first = 0; first < indices.length; first += 1) {
    for (let second = first + 1; second < indices.length; second += 1) {
      if (areHideSeekCellsAdjacent(indices[first], indices[second])) throw new Error('adjacent_mines');
    }
  }
  const mines = Array(HIDE_SEEK_CELL_COUNT).fill(false) as boolean[];
  indices.forEach(index => { mines[index] = true; });
  return mines;
}

export function areHideSeekCellsAdjacent(first: number, second: number): boolean {
  const firstRow = Math.floor(first / HIDE_SEEK_SIZE);
  const firstColumn = first % HIDE_SEEK_SIZE;
  const secondRow = Math.floor(second / HIDE_SEEK_SIZE);
  const secondColumn = second % HIDE_SEEK_SIZE;
  return Math.abs(firstRow - secondRow) <= 1 && Math.abs(firstColumn - secondColumn) <= 1;
}

export function countHideSeekAdjacentMines(mines: boolean[], cellIndex: number): number {
  let count = 0;
  for (let index = 0; index < mines.length; index += 1) {
    if (mines[index] && areHideSeekCellsAdjacent(index, cellIndex)) count += 1;
  }
  return count;
}

export function currentHideSeekRound(game: MinefieldHideSeekGame): MinefieldHideSeekRound | null {
  return game.rounds[game.phase === 'searchingSecond' || game.phase === 'finished' ? 1 : 0] ?? null;
}

function createRound(hiderUserId: string, seekerUserId: string, mines: boolean[]): MinefieldHideSeekRound {
  return { hiderUserId, seekerUserId, mines, revealed: Array(HIDE_SEEK_CELL_COUNT).fill(false), mistakes: 0, lastMove: null };
}
function isSearching(game: MinefieldHideSeekGame): boolean { return game.phase === 'searchingFirst' || game.phase === 'searchingSecond'; }
function isCellIndex(index: number): boolean { return Number.isInteger(index) && index >= 0 && index < HIDE_SEEK_CELL_COUNT; }
