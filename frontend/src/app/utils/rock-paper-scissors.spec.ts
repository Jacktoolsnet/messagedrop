import { applyRockPaperScissorsChoice, createRockPaperScissorsGame } from './rock-paper-scissors';

describe('rock-paper-scissors', () => {
  it('keeps the first choice hidden until the second player chooses', () => {
    const game = createRockPaperScissorsGame('sender', 'recipient', 'rock');
    expect(game.status).toBe('active');
    expect(game.playerOChoice).toBeNull();
    expect(game.nextPlayerUserId).toBe('recipient');
  });

  it('awards a round and continues until a player has two points', () => {
    const game = createRockPaperScissorsGame('sender', 'recipient', 'rock');
    const result = applyRockPaperScissorsChoice(game, 'recipient', 'paper');
    expect(result?.playerOScore).toBe(1);
    expect(result?.status).toBe('active');
    expect(result?.nextPlayerUserId).toBe('recipient');
  });

  it('does not award a point for a drawn round', () => {
    const game = createRockPaperScissorsGame('sender', 'recipient', 'scissors');
    const result = applyRockPaperScissorsChoice(game, 'recipient', 'scissors');
    expect(result?.playerXScore).toBe(0);
    expect(result?.playerOScore).toBe(0);
    expect(result?.rounds?.length).toBe(1);
    expect(result?.status).toBe('active');
  });

  it('ends the match when a player wins a second round', () => {
    let game = createRockPaperScissorsGame('sender', 'recipient', 'rock');
    game = applyRockPaperScissorsChoice(game, 'recipient', 'paper')!;
    game = applyRockPaperScissorsChoice(game, 'recipient', 'paper')!;
    game = applyRockPaperScissorsChoice(game, 'sender', 'rock')!;
    expect(game.status).toBe('won');
    expect(game.winnerUserId).toBe('recipient');
    expect(game.playerOScore).toBe(2);
  });
});
