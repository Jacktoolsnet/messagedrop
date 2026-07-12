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
    expect(request.request.headers.get('x-skip-ui')).toBe('true');
    expect(request.request.headers.get('x-skip-backend-status')).toBe('true');
    request.flush({ status: 200, language: 'de', articles: [], cache: { stale: false, tiles: [] }, attribution: null });
  });

  it('falls back to English for unsupported language values', () => {
    expect(service.normalizeLanguage('invalid-language')).toBe('en');
  });

  it('tracks a pin click without sending article or location data', () => {
    service.trackPinClick().subscribe();

    const request = httpTesting.expectOne(`${environment.apiUrl}/wikipedia/pin-click`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    expect(request.request.headers.get('x-skip-ui')).toBe('true');
    request.flush(null);
  });

  it('requests attribution silently with the image title', () => {
    service.getAttribution({
      pageId: 8159759,
      title: 'Donnerburgbrücke',
      latitude: 52,
      longitude: 10,
      summary: '',
      thumbnail: null,
      imageTitle: 'Donnerburgbrücke.jpg',
      articleUrl: 'https://de.wikipedia.org/wiki/Donnerburgbr%C3%BCcke'
    }, 'de-DE').subscribe();

    const request = httpTesting.expectOne((candidate) => candidate.url === `${environment.apiUrl}/wikipedia/attribution`);
    expect(request.request.params.get('language')).toBe('de');
    expect(request.request.params.get('imageTitle')).toBe('Donnerburgbrücke.jpg');
    expect(request.request.params.get('needsSummary')).toBe('true');
    expect(request.request.headers.get('x-skip-ui')).toBe('true');
    request.flush({ status: 200, article: {}, image: null, cache: 'miss' });
  });
});
