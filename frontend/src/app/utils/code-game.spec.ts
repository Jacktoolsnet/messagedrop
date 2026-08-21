import { scoreCodeGuess } from './code-game';

describe('code game', () => {
  it('scores exact and misplaced symbols without counting duplicates twice', () => {
    expect(scoreCodeGuess(
      ['star', 'star', 'circle', 'heart'],
      ['star', 'circle', 'star', 'star']
    )).toEqual({ exact: 1, misplaced: 2 });
  });
});
