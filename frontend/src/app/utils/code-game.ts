import { CodeGame, CodeGuess, CodeSymbol } from '../interfaces/chat-game';

export const CODE_SYMBOLS: readonly CodeSymbol[] = ['star', 'heart', 'circle', 'square', 'triangle', 'hexagon'];
export const CODE_LENGTH = 4;
export const CODE_MAX_GUESSES = 8;

export interface CodeSecret {
  code: CodeSymbol[];
  nonce: string;
}

export async function createCodeCommitment(secret: CodeSecret): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(secret));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('');
}

export function createCodeGame(
  codeMakerUserId: string,
  codeBreakerUserId: string,
  encryptedSecret: string,
  commitment: string,
  encryptedSecretForCodeBreaker?: string
): CodeGame {
  if (!encryptedSecret || !commitment) throw new Error('invalid_secret');
  return {
    type: 'code',
    version: 1,
    gameId: crypto.randomUUID(),
    codeMakerUserId,
    codeBreakerUserId,
    encryptedSecret,
    encryptedSecretForCodeBreaker,
    commitment,
    guesses: [],
    pendingGuess: null,
    revealedCode: null,
    revealNonce: null,
    nextPlayerUserId: codeBreakerUserId,
    status: 'active',
    winnerUserId: null,
    moveNumber: 0
  };
}

/** Evaluates on the code breaker's device, avoiding a separate codemaker turn. */
export function submitAndEvaluateCodeGuess(
  game: CodeGame,
  userId: string,
  symbols: CodeSymbol[],
  secret: CodeSecret
): CodeGame | null {
  if (game.status !== 'active' || game.nextPlayerUserId !== userId || userId !== game.codeBreakerUserId
    || game.pendingGuess || !isValidCode(symbols) || !isValidCode(secret.code)) return null;
  const result = scoreCodeGuess(secret.code, symbols);
  const guesses: CodeGuess[] = [...game.guesses, { symbols: [...symbols], ...result }];
  const solved = result.exact === CODE_LENGTH;
  const exhausted = guesses.length >= CODE_MAX_GUESSES;
  return {
    ...game,
    guesses,
    pendingGuess: null,
    revealedCode: solved || exhausted ? [...secret.code] : null,
    revealNonce: solved || exhausted ? secret.nonce : null,
    nextPlayerUserId: solved || exhausted ? null : game.codeBreakerUserId,
    status: solved || exhausted ? 'won' : 'active',
    winnerUserId: solved ? game.codeBreakerUserId : exhausted ? game.codeMakerUserId : null,
    moveNumber: game.moveNumber + 1
  };
}

export function submitCodeGuess(game: CodeGame, userId: string, symbols: CodeSymbol[]): CodeGame | null {
  if (game.status !== 'active' || game.nextPlayerUserId !== userId || userId !== game.codeBreakerUserId
    || game.pendingGuess || !isValidCode(symbols)) return null;
  return {
    ...game,
    pendingGuess: [...symbols],
    nextPlayerUserId: game.codeMakerUserId,
    moveNumber: game.moveNumber + 1
  };
}

export function evaluateCodeGuess(game: CodeGame, userId: string, secret: CodeSecret): CodeGame | null {
  if (game.status !== 'active' || game.nextPlayerUserId !== userId || userId !== game.codeMakerUserId
    || !game.pendingGuess || !isValidCode(secret.code)) return null;
  const result = scoreCodeGuess(secret.code, game.pendingGuess);
  const guesses: CodeGuess[] = [...game.guesses, { symbols: [...game.pendingGuess], ...result }];
  const solved = result.exact === CODE_LENGTH;
  const exhausted = guesses.length >= CODE_MAX_GUESSES;
  return {
    ...game,
    guesses,
    pendingGuess: null,
    revealedCode: solved || exhausted ? [...secret.code] : null,
    revealNonce: solved || exhausted ? secret.nonce : null,
    nextPlayerUserId: solved || exhausted ? null : game.codeBreakerUserId,
    status: solved || exhausted ? 'won' : 'active',
    winnerUserId: solved ? game.codeBreakerUserId : exhausted ? game.codeMakerUserId : null,
    moveNumber: game.moveNumber + 1
  };
}

export function scoreCodeGuess(secret: CodeSymbol[], guess: CodeSymbol[]): { exact: number; misplaced: number } {
  let exact = 0;
  const remainingSecret = new Map<CodeSymbol, number>();
  const remainingGuess: CodeSymbol[] = [];
  for (let index = 0; index < CODE_LENGTH; index += 1) {
    if (secret[index] === guess[index]) exact += 1;
    else {
      remainingSecret.set(secret[index], (remainingSecret.get(secret[index]) ?? 0) + 1);
      remainingGuess.push(guess[index]);
    }
  }
  let misplaced = 0;
  for (const symbol of remainingGuess) {
    const available = remainingSecret.get(symbol) ?? 0;
    if (available > 0) {
      misplaced += 1;
      remainingSecret.set(symbol, available - 1);
    }
  }
  return { exact, misplaced };
}

export function isValidCode(value: unknown): value is CodeSymbol[] {
  return Array.isArray(value) && value.length === CODE_LENGTH && value.every(symbol => CODE_SYMBOLS.includes(symbol));
}
