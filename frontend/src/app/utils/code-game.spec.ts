import { createCodeGame, scoreCodeGuess, submitAndEvaluateCodeGuess } from './code-game';

describe('code game', () => {
  it('scores exact and misplaced symbols without counting duplicates twice', () => {
    expect(scoreCodeGuess(
      ['star', 'star', 'circle', 'heart'],
      ['star', 'circle', 'star', 'star']
    )).toEqual({ exact: 1, misplaced: 2 });
  });

  it('evaluates a guess immediately and keeps the codebreaker on turn', () => {
    const game = createCodeGame('maker', 'breaker', 'maker-secret', 'commitment', 'breaker-secret');
    const next = submitAndEvaluateCodeGuess(game, 'breaker', ['star', 'circle', 'heart', 'square'], {
      code: ['star', 'heart', 'triangle', 'square'], nonce: 'nonce'
    });
    expect(next?.guesses[0]).toEqual({
      symbols: ['star', 'circle', 'heart', 'square'], exact: 2, misplaced: 1
    });
    expect(next?.nextPlayerUserId).toBe('breaker');
  });
});
