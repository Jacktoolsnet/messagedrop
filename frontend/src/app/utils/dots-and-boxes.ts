import {
  DotsAndBoxesGame,
  DotsAndBoxesMove,
  TicTacToeMark
} from '../interfaces/chat-game';

export const DOTS_AND_BOXES_DOTS_PER_SIDE = 4;
export const DOTS_AND_BOXES_BOXES_PER_SIDE = DOTS_AND_BOXES_DOTS_PER_SIDE - 1;
export const DOTS_AND_BOXES_HORIZONTAL_EDGE_COUNT = DOTS_AND_BOXES_DOTS_PER_SIDE * DOTS_AND_BOXES_BOXES_PER_SIDE;
export const DOTS_AND_BOXES_VERTICAL_EDGE_COUNT = DOTS_AND_BOXES_BOXES_PER_SIDE * DOTS_AND_BOXES_DOTS_PER_SIDE;
export const DOTS_AND_BOXES_BOX_COUNT = DOTS_AND_BOXES_BOXES_PER_SIDE ** 2;

export function createEmptyDotsAndBoxesGame(playerXUserId: string, playerOUserId: string): DotsAndBoxesGame {
  return {
    type: 'dotsAndBoxes',
    version: 1,
    gameId: crypto.randomUUID(),
    horizontalEdges: Array(DOTS_AND_BOXES_HORIZONTAL_EDGE_COUNT).fill(false),
    verticalEdges: Array(DOTS_AND_BOXES_VERTICAL_EDGE_COUNT).fill(false),
    boxes: Array(DOTS_AND_BOXES_BOX_COUNT).fill(null),
    playerXUserId,
    playerOUserId,
    nextPlayerUserId: playerXUserId,
    status: 'active',
    winnerUserId: null,
    moveNumber: 0
  };
}

export function createDotsAndBoxesGame(
  playerXUserId: string,
  playerOUserId: string,
  firstMove: DotsAndBoxesMove
): DotsAndBoxesGame {
  const game = createEmptyDotsAndBoxesGame(playerXUserId, playerOUserId);
  const result = applyDotsAndBoxesMove(game, playerXUserId, firstMove);
  if (!result) throw new Error('invalid_first_move');
  return result;
}

export function applyDotsAndBoxesMove(
  game: DotsAndBoxesGame,
  userId: string,
  move: DotsAndBoxesMove
): DotsAndBoxesGame | null {
  if (game.status !== 'active' || game.nextPlayerUserId !== userId) return null;
  const mark: TicTacToeMark | null = userId === game.playerXUserId
    ? 'X'
    : userId === game.playerOUserId
      ? 'O'
      : null;
  if (!mark || !isValidMove(move)) return null;

  const horizontalEdges = normalizeEdges(game.horizontalEdges, DOTS_AND_BOXES_HORIZONTAL_EDGE_COUNT);
  const verticalEdges = normalizeEdges(game.verticalEdges, DOTS_AND_BOXES_VERTICAL_EDGE_COUNT);
  const edges = move.orientation === 'horizontal' ? horizontalEdges : verticalEdges;
  if (edges[move.index]) return null;
  edges[move.index] = true;

  const boxes = normalizeBoxes(game.boxes);
  let claimedBoxes = 0;
  for (const boxIndex of adjacentBoxIndexes(move)) {
    if (boxes[boxIndex] === null && isBoxComplete(boxIndex, horizontalEdges, verticalEdges)) {
      boxes[boxIndex] = mark;
      claimedBoxes += 1;
    }
  }

  const moveNumber = game.moveNumber + 1;
  if (boxes.every(Boolean)) {
    const xScore = boxes.filter(box => box === 'X').length;
    const oScore = boxes.filter(box => box === 'O').length;
    const draw = xScore === oScore;
    return {
      ...game,
      horizontalEdges,
      verticalEdges,
      boxes,
      moveNumber,
      status: draw ? 'draw' : 'won',
      winnerUserId: draw ? null : xScore > oScore ? game.playerXUserId : game.playerOUserId,
      nextPlayerUserId: null
    };
  }

  return {
    ...game,
    horizontalEdges,
    verticalEdges,
    boxes,
    moveNumber,
    nextPlayerUserId: claimedBoxes > 0
      ? userId
      : mark === 'X' ? game.playerOUserId : game.playerXUserId
  };
}

function normalizeEdges(edges: readonly boolean[], count: number): boolean[] {
  return Array.from({ length: count }, (_, index) => edges[index] === true);
}

function normalizeBoxes(boxes: readonly (TicTacToeMark | null)[]): Array<TicTacToeMark | null> {
  return Array.from({ length: DOTS_AND_BOXES_BOX_COUNT }, (_, index) => {
    const box = boxes[index];
    return box === 'X' || box === 'O' ? box : null;
  });
}

function isValidMove(move: DotsAndBoxesMove): boolean {
  const count = move.orientation === 'horizontal'
    ? DOTS_AND_BOXES_HORIZONTAL_EDGE_COUNT
    : move.orientation === 'vertical'
      ? DOTS_AND_BOXES_VERTICAL_EDGE_COUNT
      : 0;
  return Number.isInteger(move.index) && move.index >= 0 && move.index < count;
}

function adjacentBoxIndexes(move: DotsAndBoxesMove): number[] {
  const indexes: number[] = [];
  if (move.orientation === 'horizontal') {
    const dotRow = Math.floor(move.index / DOTS_AND_BOXES_BOXES_PER_SIDE);
    const column = move.index % DOTS_AND_BOXES_BOXES_PER_SIDE;
    if (dotRow > 0) indexes.push((dotRow - 1) * DOTS_AND_BOXES_BOXES_PER_SIDE + column);
    if (dotRow < DOTS_AND_BOXES_BOXES_PER_SIDE) indexes.push(dotRow * DOTS_AND_BOXES_BOXES_PER_SIDE + column);
  } else {
    const row = Math.floor(move.index / DOTS_AND_BOXES_DOTS_PER_SIDE);
    const dotColumn = move.index % DOTS_AND_BOXES_DOTS_PER_SIDE;
    if (dotColumn > 0) indexes.push(row * DOTS_AND_BOXES_BOXES_PER_SIDE + dotColumn - 1);
    if (dotColumn < DOTS_AND_BOXES_BOXES_PER_SIDE) indexes.push(row * DOTS_AND_BOXES_BOXES_PER_SIDE + dotColumn);
  }
  return indexes;
}

function isBoxComplete(boxIndex: number, horizontalEdges: readonly boolean[], verticalEdges: readonly boolean[]): boolean {
  const row = Math.floor(boxIndex / DOTS_AND_BOXES_BOXES_PER_SIDE);
  const column = boxIndex % DOTS_AND_BOXES_BOXES_PER_SIDE;
  const top = row * DOTS_AND_BOXES_BOXES_PER_SIDE + column;
  const bottom = (row + 1) * DOTS_AND_BOXES_BOXES_PER_SIDE + column;
  const left = row * DOTS_AND_BOXES_DOTS_PER_SIDE + column;
  const right = left + 1;
  return horizontalEdges[top] && horizontalEdges[bottom] && verticalEdges[left] && verticalEdges[right];
}
