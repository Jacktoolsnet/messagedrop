import { createFortuneWheelGame, normalizeWheelEntries, spinFortuneWheel } from './fortune-wheel';

describe('fortune wheel', () => {
  it('accepts two to twelve non-empty entries', () => {
    expect(normalizeWheelEntries([' A ', 'B'])).toEqual(['A', 'B']);
    expect(normalizeWheelEntries(['A'])).toBeNull();
    expect(normalizeWheelEntries(Array.from({ length: 13 }, (_, index) => `${index}`))).toBeNull();
    expect(normalizeWheelEntries(['A', ' '])).toBeNull();
  });

  it('lets the recipient spin first and then alternates', () => {
    const game = createFortuneWheelGame('x', 'o', ['A', 'B', 'C']);
    const first = spinFortuneWheel(game, 'o', () => 2)!;
    expect(first.resultIndex).toBe(2);
    expect(first.nextPlayerUserId).toBe('x');
    const second = spinFortuneWheel(first, 'x', () => 0)!;
    expect(second.resultIndex).toBe(0);
    expect(second.nextPlayerUserId).toBe('o');
  });

  it('rejects out-of-turn and invalid results', () => {
    const game = createFortuneWheelGame('x', 'o', ['A', 'B']);
    expect(spinFortuneWheel(game, 'x', () => 0)).toBeNull();
    expect(spinFortuneWheel(game, 'o', () => 2)).toBeNull();
  });
});
