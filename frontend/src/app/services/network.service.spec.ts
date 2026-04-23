import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NetworkService } from './network.service';
import { TranslationHelperService } from './translation-helper.service';

describe('NetworkService', () => {
  let service: NetworkService;
  let onlineSpy: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: MatDialog,
          useValue: {
            open: jasmine.createSpy('open')
          }
        },
        {
          provide: TranslationHelperService,
          useValue: {
            t: (key: string) => key
          }
        }
      ]
    });
    service = TestBed.inject(NetworkService);
    onlineSpy = spyOnProperty(window.navigator, 'onLine', 'get').and.returnValue(true);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('returns offline messaging for gateway timeouts when the browser is offline', () => {
    onlineSpy.and.returnValue(false);

    expect(service.getErrorTitle(504)).toBe('errors.offline.title');
    expect(service.getErrorMessage(504)).toBe('errors.offline.message');
    expect(service.getErrorIcon(504)).toBe('wifi_off');
  });

  it('keeps gateway timeout messaging when the browser is online', () => {
    expect(service.getErrorTitle(504)).toBe('errors.http.title.gatewayTimeout');
    expect(service.getErrorMessage(504)).toBe('errors.http.message.gatewayTimeout');
    expect(service.getErrorIcon(504)).toBe('hourglass_disabled');
  });
});
