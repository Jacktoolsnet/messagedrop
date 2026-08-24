import { DiceRollGame } from '../interfaces/chat-game';

export const MIN_DICE_COUNT = 1;
export const MAX_DICE_COUNT = 10;

export function isValidDiceCount(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_DICE_COUNT && value <= MAX_DICE_COUNT;
}

export function createDiceRollGame(
  playerXUserId: string,
  playerOUserId: string,
  diceCount: number
): DiceRollGame {
  if (!playerXUserId || !playerOUserId || playerXUserId === playerOUserId || !isValidDiceCount(diceCount)) {
    throw new Error('invalid_dice_roll');
  }

  return {
    type: 'diceRoll',
    version: 1,
    gameId: crypto.randomUUID(),
    playerXUserId,
    playerOUserId,
    diceCount,
    lastRoll: [],
    lastRollUserId: null,
    nextPlayerUserId: playerOUserId,
    status: 'active',
    winnerUserId: null,
    moveNumber: 0
  };
}

export function rollDice(
  game: DiceRollGame,
  userId: string,
  random: () => number = secureRandom
): DiceRollGame | null {
  if (game.nextPlayerUserId !== userId || !isValidDiceCount(game.diceCount)) {
    return null;
  }

  const isX = userId === game.playerXUserId;
  if (!isX && userId !== game.playerOUserId) {
    return null;
  }

  return {
    ...game,
    lastRoll: Array.from({ length: game.diceCount }, () =>
      Math.min(6, Math.max(1, Math.floor(random() * 6) + 1))
    ),
    lastRollUserId: userId,
    nextPlayerUserId: isX ? game.playerOUserId : game.playerXUserId,
    moveNumber: game.moveNumber + 1
  };
}

function secureRandom(): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] / 0x1_0000_0000;
}
