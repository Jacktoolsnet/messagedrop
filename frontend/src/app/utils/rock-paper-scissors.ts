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
    || userId !== game.playerOUserId
    || game.playerOChoice !== null
    || !isRockPaperScissorsChoice(choice)
  ) {
    return null;
  }

  if (choice === game.playerXChoice) {
    return {
      ...game,
      playerOChoice: choice,
      nextPlayerUserId: null,
      status: 'draw',
      winnerUserId: null,
      moveNumber: 2
    };
  }

  const playerXWins = WINNING_CHOICES[game.playerXChoice] === choice;
  return {
    ...game,
    playerOChoice: choice,
    nextPlayerUserId: null,
    status: 'won',
    winnerUserId: playerXWins ? game.playerXUserId : game.playerOUserId,
    moveNumber: 2
  };
}

export function isRockPaperScissorsChoice(value: unknown): value is RockPaperScissorsChoice {
  return value === 'rock' || value === 'paper' || value === 'scissors';
}
