import { applyRockPaperScissorsChoice, createRockPaperScissorsGame } from './rock-paper-scissors';

describe('rock-paper-scissors', () => {
  it('keeps the first choice hidden until the second player chooses', () => {
    const game = createRockPaperScissorsGame('sender', 'recipient', 'rock');
    expect(game.status).toBe('active');
    expect(game.playerOChoice).toBeNull();
    expect(game.nextPlayerUserId).toBe('recipient');
  });

  it('detects the winner', () => {
    const game = createRockPaperScissorsGame('sender', 'recipient', 'rock');
    const result = applyRockPaperScissorsChoice(game, 'recipient', 'paper');
    expect(result?.winnerUserId).toBe('recipient');
    expect(result?.status).toBe('won');
  });

  it('detects a draw', () => {
    const game = createRockPaperScissorsGame('sender', 'recipient', 'scissors');
    expect(applyRockPaperScissorsChoice(game, 'recipient', 'scissors')?.status).toBe('draw');
  });
});
