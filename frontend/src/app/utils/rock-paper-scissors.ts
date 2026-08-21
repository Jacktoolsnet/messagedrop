import {
  RockPaperScissorsChoice,
  RockPaperScissorsGame
} from '../interfaces/chat-game';

const WINNING_CHOICES: Record<RockPaperScissorsChoice, RockPaperScissorsChoice> = {
  rock: 'scissors',
  paper: 'rock',
  scissors: 'paper'
};

export function createRockPaperScissorsGame(
  playerXUserId: string,
  playerOUserId: string,
  firstChoice: RockPaperScissorsChoice
): RockPaperScissorsGame {
  if (!isRockPaperScissorsChoice(firstChoice)) throw new Error('invalid_first_choice');
  return {
    type: 'rockPaperScissors',
    version: 1,
    gameId: crypto.randomUUID(),
    playerXUserId,
    playerOUserId,
    playerXChoice: firstChoice,
    playerOChoice: null,
    rounds: [],
    playerXScore: 0,
    playerOScore: 0,
    roundFirstPlayerUserId: playerXUserId,
    nextPlayerUserId: playerOUserId,
    status: 'active',
    winnerUserId: null,
    moveNumber: 1
  };
}

export function applyRockPaperScissorsChoice(
  game: RockPaperScissorsGame,
  userId: string,
  choice: RockPaperScissorsChoice
): RockPaperScissorsGame | null {
  if (
    game.status !== 'active'
    || game.nextPlayerUserId !== userId
    || !isRockPaperScissorsChoice(choice)
  ) {
    return null;
  }

  const playerXChoice = userId === game.playerXUserId ? choice : game.playerXChoice;
  const playerOChoice = userId === game.playerOUserId ? choice : game.playerOChoice;
  if ((userId === game.playerXUserId && game.playerXChoice !== null)
    || (userId === game.playerOUserId && game.playerOChoice !== null)) {
    return null;
  }

  if (!playerXChoice || !playerOChoice) {
    return {
      ...game,
      playerXChoice,
      playerOChoice,
      nextPlayerUserId: userId === game.playerXUserId ? game.playerOUserId : game.playerXUserId,
      moveNumber: game.moveNumber + 1
    };
  }

  const roundWinnerUserId = playerXChoice === playerOChoice
    ? null
    : WINNING_CHOICES[playerXChoice] === playerOChoice
      ? game.playerXUserId
      : game.playerOUserId;
  const rounds = [
    ...(game.rounds ?? []),
    { playerXChoice, playerOChoice, winnerUserId: roundWinnerUserId }
  ];
  const playerXScore = (game.playerXScore ?? 0) + (roundWinnerUserId === game.playerXUserId ? 1 : 0);
  const playerOScore = (game.playerOScore ?? 0) + (roundWinnerUserId === game.playerOUserId ? 1 : 0);
  const matchWinnerUserId = playerXScore >= 2
    ? game.playerXUserId
    : playerOScore >= 2
      ? game.playerOUserId
      : null;
  if (matchWinnerUserId) {
    return {
      ...game,
      playerXChoice,
      playerOChoice,
      rounds,
      playerXScore,
      playerOScore,
      nextPlayerUserId: null,
      status: 'won',
      winnerUserId: matchWinnerUserId,
      moveNumber: game.moveNumber + 1
    };
  }

  const previousFirstPlayerUserId = game.roundFirstPlayerUserId ?? game.playerXUserId;
  const roundFirstPlayerUserId = previousFirstPlayerUserId === game.playerXUserId
    ? game.playerOUserId
    : game.playerXUserId;
  return {
    ...game,
    playerXChoice: null,
    playerOChoice: null,
    rounds,
    playerXScore,
    playerOScore,
    roundFirstPlayerUserId,
    nextPlayerUserId: roundFirstPlayerUserId,
    status: 'active',
    winnerUserId: null,
    moveNumber: game.moveNumber + 1
  };
}

export function isRockPaperScissorsChoice(value: unknown): value is RockPaperScissorsChoice {
  return value === 'rock' || value === 'paper' || value === 'scissors';
}
