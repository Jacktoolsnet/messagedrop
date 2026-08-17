const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('./fixtures/poi-sample.json');
const { normalizeGeodataResponse } = require('../normalizer');

test('normalizes nodes and area centers without leaking raw tags', () => {
  const pois = normalizeGeodataResponse(fixture, ['accommodation', 'leisure']);
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

test('classifies religious buildings and generic places of worship', () => {
  const pois = normalizeGeodataResponse({ elements: [
    { type: 'node', id: 10, lat: 52.1, lon: 10.2,
      tags: { amenity: 'place_of_worship', building: 'cathedral', tourism: 'attraction', name: 'Test Cathedral' } },
    { type: 'node', id: 11, lat: 52.2, lon: 10.3,
      tags: { amenity: 'place_of_worship', religion: 'sikh', name: 'Test Gurdwara' } }
  ] }, ['tourism', 'religion']);

  assert.equal(pois[0].category, 'religion');
  assert.equal(pois[0].subtype, 'cathedral');
  assert.equal(pois[1].category, 'religion');
  assert.equal(pois[1].subtype, 'place_of_worship');
});

test('classifies specific government offices before the generic government fallback', () => {
  const pois = normalizeGeodataResponse({ elements: [
    { type: 'node', id: 20, lat: 52.1, lon: 10.2,
      tags: { office: 'government', government: 'tax', name: 'Tax office' } },
    { type: 'node', id: 21, lat: 52.2, lon: 10.3,
      tags: { office: 'government', name: 'Public authority' } }
  ] }, ['amenities']);

  assert.equal(pois[0].subtype, 'tax_office');
  assert.equal(pois[1].subtype, 'government_office');
});
