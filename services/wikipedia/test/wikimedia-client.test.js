const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeCreator, parseRetryAfterMs, safeHttpsUrl } = require('../clients/wikimedia-client');

test('safeHttpsUrl accepts HTTPS Wikimedia URLs', () => {
  assert.equal(
    safeHttpsUrl('https://commons.wikimedia.org/wiki/File:Example.jpg'),
    'https://commons.wikimedia.org/wiki/File:Example.jpg'
  );
});

test('safeHttpsUrl rejects executable and insecure URL schemes', () => {
  assert.equal(safeHttpsUrl('javascript:alert(1)'), '');
  assert.equal(safeHttpsUrl('http://example.org/image.jpg'), '');
  assert.equal(safeHttpsUrl('not a url'), '');
});

test('safeHttpsUrl uses a trusted fallback', () => {
  assert.equal(safeHttpsUrl('', 'https://de.wikipedia.org/'), 'https://de.wikipedia.org/');
});

test('parseRetryAfterMs supports delay seconds', () => {
  assert.equal(parseRetryAfterMs('12', 0), 12000);
});

test('parseRetryAfterMs supports HTTP dates', () => {
  const now = Date.parse('2026-07-12T18:00:00Z');
  assert.equal(parseRetryAfterMs('Sun, 12 Jul 2026 18:00:10 GMT', now), 10000);
});

test('normalizeCreator removes file history and de-duplicates derivative creators', () => {
  const value = ': Braunschweig.gif : * Braunschweig.png : * Braunschweig.jpg : User:Brunswyk derivative work: Parzi derivative work: Parzi';
  assert.equal(normalizeCreator(value), 'Brunswyk; Parzi');
});
