const test = require('node:test');
const assert = require('node:assert/strict');
const { tileBounds, tilesForBounds } = require('../utils/tiles');

test('tileBounds returns ordered geographic bounds', () => {
  const bounds = tileBounds(8801, 5374, 14);
  assert.ok(bounds.north > bounds.south);
  assert.ok(bounds.east > bounds.west);
});

test('similar viewports reuse at least one cache tile', () => {
  const first = tilesForBounds({ north: 52.522, south: 52.51, east: 13.41, west: 13.39 }, 14);
  const second = tilesForBounds({ north: 52.523, south: 52.511, east: 13.411, west: 13.391 }, 14);
  const keys = new Set(first.map(({ x, y }) => `${x}:${y}`));
  assert.ok(second.some(({ x, y }) => keys.has(`${x}:${y}`)));
});

test('oversized viewports are rejected', () => {
  assert.throws(
    () => tilesForBounds({ north: 60, south: 40, east: 20, west: -10 }, 14, 64),
    /viewport_too_large/
  );
});

test('antimeridian viewports are explicitly rejected for v1', () => {
  assert.throws(
    () => tilesForBounds({ north: 10, south: 0, east: -170, west: 170 }, 14),
    /antimeridian_not_supported/
  );
});
