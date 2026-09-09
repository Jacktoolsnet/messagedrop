import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { AppService } from './app.service';
import { LanguageService, SupportedLang } from './language.service';
import { NetworkService } from './network.service';
import { TranslationHelperService } from './translation-helper.service';
import { ViatorService } from './viator.service';

describe('ViatorService', () => {
  let service: ViatorService;
  let http: HttpTestingController;
  const effectiveLanguage = signal<SupportedLang>('en');

  beforeEach(() => {
    effectiveLanguage.set('en');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AppService, useValue: { getAppSettings: () => ({ enableViatorContent: true }) } },
        { provide: LanguageService, useValue: { effectiveLanguage } },
        { provide: NetworkService, useValue: { setNetworkMessageConfig: jasmine.createSpy('setNetworkMessageConfig') } },
        { provide: TranslationHelperService, useValue: { t: (key: string) => key } }
      ]
    });
    service = TestBed.inject(ViatorService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('uses the selected app language for Viator requests instead of the browser language', () => {
    effectiveLanguage.set('de');

    service.searchProducts({} as never).subscribe();

    const request = http.expectOne(`${environment.apiUrl}/viator/products/search`);
    expect(request.request.headers.get('Accept-Language')).toBe('de');
    request.flush({ products: [], totalCount: 0 });
  });
});
