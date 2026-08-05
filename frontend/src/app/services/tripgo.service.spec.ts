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

  it('requests public transport routes and unwraps the response', () => {
    const from: Location = { latitude: 52.52, longitude: 13.405, plusCode: 'FROM' };
    const to: Location = { latitude: 52.51, longitude: 13.38, plusCode: 'TO' };
    const result = { routes: [], meta: { groups: 0, totalRoutes: 0, returnedRoutes: 0 } };

    service.calculatePublicTransportRoute(from, to, 'de').subscribe((value) => expect(value).toEqual(result));

    const request = http.expectOne(`${environment.apiUrl}/tripgo/routes`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      from: { latitude: 52.52, longitude: 13.405 },
      to: { latitude: 52.51, longitude: 13.38 },
      locale: 'de',
      modes: ['pt_pub']
    });
    request.flush({ status: 200, data: result, cache: 'miss' });
  });
});
