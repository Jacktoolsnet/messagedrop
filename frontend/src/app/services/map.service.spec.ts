import { TestBed } from '@angular/core/testing';
import { OverpassCategory, OverpassPoi } from '../interfaces/overpass';

import { MapService, overpassPoiGroupMarker } from './map.service';

describe('MapService', () => {
  let service: MapService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MapService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('keeps the category icon when grouped Overpass places share one category', () => {
    const pois = [overpassPoi('first', 'tourism'), overpassPoi('second', 'tourism')];

    expect(String(overpassPoiGroupMarker(pois, pois[0]).options.html)).toContain('photo_camera');
  });

  it('uses the neutral icon when grouped Overpass places contain several categories', () => {
    const pois = [overpassPoi('first', 'tourism'), overpassPoi('second', 'religion')];

    expect(String(overpassPoiGroupMarker(pois, pois[0]).options.html)).toContain('location_on');
  });
});

function overpassPoi(id: string, category: OverpassCategory): OverpassPoi {
  return {
    id,
    osmType: 'node',
    osmId: Number(id === 'first' ? 1 : 2),
    category,
    subtype: category === 'tourism' ? 'memorial' : 'church',
    name: id,
    latitude: 52,
    longitude: 10,
    address: {},
    contact: {},
    properties: {},
    source: { provider: 'OpenStreetMap', url: 'https://www.openstreetmap.org' }
  } as OverpassPoi;
}
