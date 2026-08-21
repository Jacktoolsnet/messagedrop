import { MemoryGame, MemorySymbol, TicTacToeMark } from '../interfaces/chat-game';

export const MEMORY_SYMBOLS: readonly MemorySymbol[] = [
  'pets', 'forest', 'star', 'favorite', 'music_note', 'flight', 'restaurant', 'sports_soccer'
];

export function createMemoryDeck(random: () => number = Math.random): MemorySymbol[] {
  const deck = [...MEMORY_SYMBOLS, ...MEMORY_SYMBOLS];
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }
  return deck;
}

export function createMemoryGame(
  playerXUserId: string,
  playerOUserId: string,
  cards: MemorySymbol[],
  firstCardIndices: [number, number]
): MemoryGame {
  if (!isValidMemoryDeck(cards)) throw new Error('invalid_deck');
  const emptyGame: MemoryGame = {
    type: 'memory', version: 1, gameId: crypto.randomUUID(), cards: [...cards],
    matchedBy: Array(16).fill(null), playerXUserId, playerOUserId,
    nextPlayerUserId: playerXUserId, status: 'active', winnerUserId: null,
    moveNumber: 0, lastMove: null
  };
  const game = applyMemoryTurn(emptyGame, playerXUserId, firstCardIndices);
  if (!game) throw new Error('invalid_first_turn');
  return game;
}

export function applyMemoryTurn(
  game: MemoryGame,
  userId: string,
  cardIndices: [number, number]
): MemoryGame | null {
  if (game.status !== 'active' || game.nextPlayerUserId !== userId || !isValidTurn(game, cardIndices)) return null;
  let mark: TicTacToeMark;
  if (userId === game.playerXUserId) mark = 'X';
  else if (userId === game.playerOUserId) mark = 'O';
  else return null;
  const [first, second] = cardIndices;
  const matched = game.cards[first] === game.cards[second];
  const matchedBy = [...game.matchedBy];
  if (matched) {
    matchedBy[first] = mark;
    matchedBy[second] = mark;
  }
  const moveNumber = game.moveNumber + 1;
  const finished = matchedBy.every(Boolean);
  const playerXScore = matchedBy.filter(owner => owner === 'X').length / 2;
  const playerOScore = matchedBy.filter(owner => owner === 'O').length / 2;
  const status = finished ? (playerXScore === playerOScore ? 'draw' : 'won') : 'active';
  const winnerUserId = status === 'won'
    ? playerXScore > playerOScore ? game.playerXUserId : game.playerOUserId
    : null;
  return {
    ...game,
    matchedBy,
    nextPlayerUserId: finished ? null : matched ? userId : otherPlayer(game, userId),
    status,
    winnerUserId,
    moveNumber,
    lastMove: { playerUserId: userId, cardIndices: [first, second], matched, moveNumber }
  };
}

export function memoryScore(game: MemoryGame, mark: TicTacToeMark): number {
  return game.matchedBy.filter(owner => owner === mark).length / 2;
}

export function isValidMemoryDeck(cards: unknown): cards is MemorySymbol[] {
  if (!Array.isArray(cards) || cards.length !== 16 || !cards.every(card => MEMORY_SYMBOLS.includes(card))) return false;
  return MEMORY_SYMBOLS.every(symbol => cards.filter(card => card === symbol).length === 2);
}

function isValidTurn(game: MemoryGame, indices: [number, number]): boolean {
  return Array.isArray(indices) && indices.length === 2 && indices[0] !== indices[1]
    && indices.every(index => Number.isInteger(index) && index >= 0 && index < 16 && !game.matchedBy[index]);
}

function otherPlayer(game: MemoryGame, userId: string): string {
  return userId === game.playerXUserId ? game.playerOUserId : game.playerXUserId;
}
