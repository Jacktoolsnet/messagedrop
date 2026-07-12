import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { WikipediaService } from './wikipedia.service';

describe('WikipediaService', () => {
  let service: WikipediaService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(WikipediaService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('requests nearby articles with normalized parameters', () => {
    service.getNearby({ north: 52.52, south: 52.51, east: 13.41, west: 13.39, zoom: 14, language: 'de-DE' })
      .subscribe();

    const request = httpTesting.expectOne((candidate) => candidate.url === `${environment.apiUrl}/wikipedia/nearby`);
    expect(request.request.params.get('language')).toBe('de');
    expect(request.request.params.get('zoom')).toBe('14');
    expect(request.request.params.get('limit')).toBe('100');
    request.flush({ status: 200, language: 'de', articles: [], cache: { stale: false, tiles: [] }, attribution: null });
  });

  it('falls back to English for unsupported language values', () => {
    expect(service.normalizeLanguage('invalid-language')).toBe('en');
  });
});
