const test = require('node:test');
const assert = require('node:assert/strict');
const { quoteIdentifier } = require('../scripts/create-database');

test('quotes safe database identifiers and rejects unsafe input', () => {
  assert.equal(quoteIdentifier('messagedrop_geodata'), '"messagedrop_geodata"');
  assert.throws(() => quoteIdentifier('db; DROP DATABASE postgres'), /Unsafe PostgreSQL identifier/u);
});
