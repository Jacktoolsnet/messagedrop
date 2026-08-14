const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('./fixtures/poi-sample.json');
const { normalizeOverpassResponse } = require('../normalizer');

test('normalizes nodes and area centers without leaking raw tags', () => {
  const pois = normalizeOverpassResponse(fixture, ['accommodation', 'leisure']);
  assert.equal(pois.length, 3);
  assert.deepEqual(pois[0], {
    id: 'osm:node:1', osmType: 'node', osmId: 1, category: 'accommodation', subtype: 'hotel',
    name: 'Hotel Café', latitude: 52.1, longitude: 10.2,
    address: { street: 'Main Street', houseNumber: '1' },
    contact: { website: 'https://example.test' },
    properties: {
      stars: '4',
      description: 'Historic hotel',
      descriptions: { de: 'Historisches Hotel' },
      inscription: 'First line|Second line',
      inscriptions: { fr: 'Première ligne|Deuxième ligne' }
    },
    source: { provider: 'OpenStreetMap', url: 'https://www.openstreetmap.org/node/1' }
  });
  assert.equal(pois[1].latitude, 52.1002);
  assert.equal(pois[2].category, 'leisure');
});
