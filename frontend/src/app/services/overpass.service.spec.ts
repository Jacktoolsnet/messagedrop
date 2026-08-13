import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { OverpassPoi } from '../interfaces/overpass';
import { OverpassService } from './overpass.service';

describe('OverpassService', () => {
  let service: OverpassService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(OverpassService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends selected accommodation types and public toilets', () => {
    const bounds = [{ latMin: 52.13, lonMin: 10.5, latMax: 52.19, lonMax: 10.61 }];
    const poi = {
      id: 'osm:node:1', osmType: 'node', osmId: 1, category: 'amenities', subtype: 'toilets',
      name: 'Öffentliche Toilette', latitude: 52.16, longitude: 10.54,
      address: {}, contact: {}, properties: {},
      source: { provider: 'OpenStreetMap', url: 'https://www.openstreetmap.org/node/1' }
    } as OverpassPoi;

    service.getNearby(bounds, { accommodation: ['hotel', 'hostel'], amenities: ['toilets'] })
      .subscribe((pois) => expect(pois).toEqual([poi]));

    const request = http.expectOne(`${environment.apiUrl}/overpass/nearby`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('x-skip-ui')).toBe('true');
    expect(request.request.body).toEqual({
      bounds: { south: 52.13, west: 10.5, north: 52.19, east: 10.61 },
      categories: ['accommodation', 'amenities'],
      subcategories: { accommodation: ['hotel', 'hostel'], amenities: ['toilets'] },
      limit: 500
    });
    request.flush({ status: 200, pois: [poi], count: 1, cache: 'miss' });
  });

  it('loads and normalizes categories enabled by the admin settings', () => {
    service.getAvailability().subscribe((availability) => expect(availability).toEqual({
      accommodation: ['hotel'], amenities: ['toilets']
    }));

    const request = http.expectOne(`${environment.apiUrl}/overpass/availability`);
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('x-skip-ui')).toBe('true');
    request.flush({
      status: 200,
      categories: ['accommodation', 'amenities'],
      subcategories: { accommodation: ['hotel'], amenities: ['toilets'], tourism: ['museum'] },
      updatedAt: 123
    });
  });
});
