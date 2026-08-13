const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCatalog } = require('../geofabrik-catalog');

function feature(properties) {
  return { type: 'Feature', properties };
}

test('builds importable continents, countries and direct country subdivisions from the Geofabrik index', () => {
  const catalog = buildCatalog({ features: [
    feature({ id: 'europe', name: 'Europe', urls: { pbf: 'https://download.test/europe.pbf' } }),
    feature({ id: 'germany', parent: 'europe', name: 'Germany', 'iso3166-1:alpha2': ['DE'],
      urls: { pbf: 'https://download.test/germany-latest.osm.pbf' } }),
    feature({ id: 'niedersachsen', parent: 'germany', name: 'Niedersachsen', 'iso3166-2': ['DE-NI'],
      urls: { pbf: 'https://download.test/niedersachsen-latest.osm.pbf' } }),
    feature({ id: 'braunschweig', parent: 'niedersachsen', name: 'Braunschweig',
      urls: { pbf: 'https://download.test/braunschweig-latest.osm.pbf' } })
  ] });

  assert.equal(catalog.definitions.germany.level, 'country');
  assert.deepEqual(catalog.definitions.germany.supersedes, ['wolfenbuettel']);
  assert.equal(catalog.definitions.niedersachsen.level, 'state');
  assert.equal(catalog.definitions.niedersachsen.regionCode, 'DE-NI');
  assert.equal(catalog.definitions.braunschweig, undefined);
  assert.ok(!catalog.display.some((dataset) => dataset.id === 'wolfenbuettel'));
  assert.ok(catalog.display.every((dataset) => dataset.continentCode === 'EU' && dataset.countryCode === 'DE'));
});

test('exposes a shared extract for every country code it contains without duplicating the import definition', () => {
  const catalog = buildCatalog({ features: [
    feature({ id: 'asia', name: 'Asia', urls: { pbf: 'https://download.test/asia.pbf' } }),
    feature({ id: 'three-countries', parent: 'asia', name: 'Three countries',
      'iso3166-1:alpha2': ['AA', 'BB', 'CC'], urls: { pbf: 'https://download.test/three.pbf' } })
  ] });
  assert.deepEqual(catalog.display.map((dataset) => dataset.countryCode), ['AA', 'BB', 'CC']);
  assert.equal(catalog.display.filter((dataset) => dataset.id === 'three-countries').length, 3);
  assert.equal(catalog.definitions['three-countries'].sourceUrl, 'https://download.test/three.pbf');
});
