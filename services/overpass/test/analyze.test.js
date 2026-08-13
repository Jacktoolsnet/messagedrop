const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('./fixtures/poi-sample.json');
const { analyze, normalizeName } = require('../scripts/analyze-poi-sample');

test('analyzes tag coverage and duplicate candidates', () => {
  const report = analyze(fixture);
  assert.equal(report.counts.elements, 4);
  assert.equal(report.counts.missingCoordinates, 1);
  assert.equal(report.primaryValues.tourism.hotel, 2);
  assert.equal(report.coverage.website.count, 1);
  assert.equal(report.possibleDuplicates.count, 1);
});

test('normalizes names for duplicate analysis', () => {
  assert.equal(normalizeName('Hôtel-Café'), 'hotel cafe');
});
