const test = require('node:test');
const assert = require('node:assert/strict');
const { safeHttpsUrl } = require('../clients/wikimedia-client');

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
