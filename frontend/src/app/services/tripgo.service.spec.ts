import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { Location } from '../interfaces/location';
import { TripGoService } from './tripgo.service';

describe('TripGoService', () => {
  let service: TripGoService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(TripGoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests routes for the selected modes and unwraps the response', () => {
    const from: Location = { latitude: 52.52, longitude: 13.405, plusCode: 'FROM' };
    const to: Location = { latitude: 52.51, longitude: 13.38, plusCode: 'TO' };
    const result = { routes: [], meta: { groups: 0, totalRoutes: 0, returnedRoutes: 0 } };

    service.calculateRoute(from, to, 'de', ['me_mic_bic', 'pt_pub'])
      .subscribe((value) => expect(value).toEqual(result));

    const request = http.expectOne(`${environment.apiUrl}/tripgo/routes`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('x-skip-ui')).toBe('true');
    expect(request.request.body).toEqual({
      from: { latitude: 52.52, longitude: 13.405 },
      to: { latitude: 52.51, longitude: 13.38 },
      locale: 'de',
      modes: ['me_mic_bic', 'pt_pub']
    });
    request.flush({ status: 200, data: result, cache: 'miss' });
  });

  it('requests current details for a scheduled service', () => {
    const segment = {
      id: 'segment-1', geometry: [], startTime: '2026-08-06T08:00:00Z',
      from: { region: 'DE_NI_Hanover', stopCode: 'start' },
      to: { stopCode: 'end' },
      service: { tripId: 'trip-1', operatorId: 'operator-1' }
    };
    const result = { updatedAt: '2026-08-06T07:59:00Z', alerts: [], stops: [], geometry: [] };

    service.getServiceDetails(segment, 'de').subscribe((value) => expect(value).toEqual(result));

    const request = http.expectOne(`${environment.apiUrl}/tripgo/service`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.has('x-skip-ui')).toBeTrue();
    expect(request.request.body).toEqual({
      region: 'DE_NI_Hanover', serviceTripId: 'trip-1', operator: 'operator-1',
      startStopCode: 'start', endStopCode: 'end',
      embarkationTime: '2026-08-06T08:00:00Z', locale: 'de'
    });
    request.flush({ status: 200, data: result, cache: 'miss' });
  });

  it('requests public transport stops for the visible map bounds', () => {
    const bounds = [{ latMin: 52.13, lonMin: 10.52, latMax: 52.15, lonMax: 10.56 }];
    const stops = [{
      id: 'stop-1', name: 'Halchter, Bernardusring', latitude: 52.14185, longitude: 10.54259,
      region: 'DE_NI_Hanover', modeIdentifiers: ['pt_pub_bus'], modeLabels: ['Bus'],
      stopTypes: ['bus'], services: ['794'], operators: [], platforms: []
    }];

    service.getStops(bounds, 'de').subscribe((value) => expect(value).toEqual(stops));

    const request = http.expectOne(`${environment.apiUrl}/tripgo/locations`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('x-skip-ui')).toBe('true');
    expect(request.request.body).toEqual({ bounds, locale: 'de' });
    request.flush({ status: 200, data: { region: 'DE_NI_Hanover', stops }, cache: 'miss' });
  });
});
