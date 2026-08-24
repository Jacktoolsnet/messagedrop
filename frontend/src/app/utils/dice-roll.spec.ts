import { createDiceRollGame, isValidDiceCount, rollDice } from './dice-roll';

describe('dice roll', () => {
  it('accepts between one and ten dice', () => {
    expect(isValidDiceCount(1)).toBeTrue();
    expect(isValidDiceCount(10)).toBeTrue();
    expect(isValidDiceCount(0)).toBeFalse();
    expect(isValidDiceCount(11)).toBeFalse();
  });

  it('lets the contact roll first and alternates every roll', () => {
    const game = createDiceRollGame('x', 'o', 3);
    expect(game.nextPlayerUserId).toBe('o');

    const first = rollDice(game, 'o', () => 0)!;
    expect(first.lastRoll).toEqual([1, 1, 1]);
    expect(first.nextPlayerUserId).toBe('x');

    const second = rollDice(first, 'x', () => 0.999999)!;
    expect(second.lastRoll).toEqual([6, 6, 6]);
    expect(second.nextPlayerUserId).toBe('o');
  });

  it('rejects a roll from the participant who is not active', () => {
    const game = createDiceRollGame('x', 'o', 2);
    expect(rollDice(game, 'x', () => 0.5)).toBeNull();
  });
});
