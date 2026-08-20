import { TestBed } from '@angular/core/testing';
import { GeodataCategory, GeodataPoi } from '../interfaces/geodata';

import { MapService, geodataPoiGroupMarker, geodataPoiMarker } from './map.service';

describe('MapService', () => {
  let service: MapService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MapService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('keeps the category icon when grouped Geodata places share one category', () => {
    const pois = [geodataPoi('first', 'tourism'), geodataPoi('second', 'tourism')];

    expect(String(geodataPoiGroupMarker(pois, pois[0]).options.html)).toContain('photo_camera');
  });

  it('uses the neutral icon when grouped Geodata places contain several categories', () => {
    const pois = [geodataPoi('first', 'tourism'), geodataPoi('second', 'religion')];

    expect(String(geodataPoiGroupMarker(pois, pois[0]).options.html)).toContain('location_on');
  });

  it('uses a dedicated icon for public toilets', () => {
    const poi = geodataPoi('toilet', 'amenities', 'toilets');

    expect(String(geodataPoiMarker(poi).options.html)).toContain('>wc</text>');
  });

  it('uses the neutral icon for a grouped toilet and government office', () => {
    const pois = [
      geodataPoi('toilet', 'amenities', 'toilets'),
      geodataPoi('office', 'amenities', 'government_office')
    ];

    expect(String(geodataPoiGroupMarker(pois, pois[0]).options.html)).toContain('location_on');
  });
});

function geodataPoi(
  id: string,
  category: GeodataCategory,
  subtype: GeodataPoi['subtype'] = category === 'tourism' ? 'memorial' : 'church'
): GeodataPoi {
  return {
    id,
    osmType: 'node',
    osmId: Number(id === 'first' ? 1 : 2),
    category,
    subtype,
    name: id,
    latitude: 52,
    longitude: 10,
    address: {},
    contact: {},
    properties: {},
    source: { provider: 'OpenStreetMap', url: 'https://www.openstreetmap.org' }
  } as GeodataPoi;
}
