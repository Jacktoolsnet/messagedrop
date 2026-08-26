import { FortuneWheelGame } from '../interfaces/chat-game';

export const MIN_WHEEL_ENTRIES = 2;
export const MAX_WHEEL_ENTRIES = 12;
export const MAX_WHEEL_ENTRY_LENGTH = 30;

export function normalizeWheelEntries(entries: readonly string[]): string[] | null {
  if (entries.length < MIN_WHEEL_ENTRIES || entries.length > MAX_WHEEL_ENTRIES) return null;
  const normalized = entries.map(entry => entry.trim());
  return normalized.every(entry => entry.length > 0 && entry.length <= MAX_WHEEL_ENTRY_LENGTH) ? normalized : null;
}

export function createFortuneWheelGame(
  playerXUserId: string,
  playerOUserId: string,
  entries: readonly string[]
): FortuneWheelGame {
  const normalized = normalizeWheelEntries(entries);
  if (!playerXUserId || !playerOUserId || playerXUserId === playerOUserId || !normalized) {
    throw new Error('invalid_fortune_wheel');
  }
  return {
    type: 'fortuneWheel', version: 1, gameId: crypto.randomUUID(),
    playerXUserId, playerOUserId, entries: normalized,
    resultIndex: null, lastSpinUserId: null, nextPlayerUserId: playerOUserId,
    status: 'active', winnerUserId: null, moveNumber: 0
  };
}

export function spinFortuneWheel(
  game: FortuneWheelGame,
  userId: string,
  selectIndex: (entryCount: number) => number = secureRandomIndex
): FortuneWheelGame | null {
  const entries = normalizeWheelEntries(game.entries);
  if (!entries || game.nextPlayerUserId !== userId) return null;
  const isX = userId === game.playerXUserId;
  if (!isX && userId !== game.playerOUserId) return null;
  const resultIndex = selectIndex(entries.length);
  if (!Number.isInteger(resultIndex) || resultIndex < 0 || resultIndex >= entries.length) return null;
  return {
    ...game,
    entries,
    resultIndex,
    lastSpinUserId: userId,
    nextPlayerUserId: isX ? game.playerOUserId : game.playerXUserId,
    moveNumber: game.moveNumber + 1
  };
}

function secureRandomIndex(entryCount: number): number {
  const range = 0x1_0000_0000;
  const limit = Math.floor(range / entryCount) * entryCount;
  const value = new Uint32Array(1);
  do crypto.getRandomValues(value); while (value[0] >= limit);
  return value[0] % entryCount;
}
